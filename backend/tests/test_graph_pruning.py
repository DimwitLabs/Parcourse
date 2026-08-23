"""What a deletion is allowed to take with it. Forgetting a concept takes down
whatever only stood on it; deleting a course must leave the concepts a surviving
one hangs from, or it strands them with nothing to join them to the rest.

These run against a real SQLite session, so the queries inside the two rules are
covered rather than restated by a fake.
"""

import unittest
import uuid

from sqlalchemy import event
from sqlmodel import Session, create_engine

from models.base import SQLModelBase
from models.knowledge_graph import EdgeType, KnowledgeEdge, KnowledgeNode, NodeTier
from services.knowledge_graph import ancestors, falling

FIELD = uuid.uuid4()
TOPIC = uuid.uuid4()
OTHER_TOPIC = uuid.uuid4()
SKILL = uuid.uuid4()
DEEPER = uuid.uuid4()

TIERS = {
    FIELD: NodeTier.field,
    TOPIC: NodeTier.topic,
    OTHER_TOPIC: NodeTier.topic,
    SKILL: NodeTier.skill,
    DEEPER: NodeTier.skill,
}


def graph(*edges, nodes=TIERS.keys()):
    """A session holding these concepts and the edges between them."""
    engine = create_engine("sqlite://")
    schema = SQLModelBase.metadata.schema
    if schema:
        # The models are bound to a named schema; SQLite only has one, so it is
        # attached under that name for the tables to land in.
        event.listen(
            engine,
            "connect",
            lambda connection, _: connection.execute(f"ATTACH DATABASE ':memory:' AS {schema}"),
        )
    SQLModelBase.metadata.create_all(engine)
    session = Session(engine)
    for node_id in nodes:
        session.add(KnowledgeNode(id=node_id, tier=TIERS[node_id], label=str(node_id), description=""))
    for source, target, edge_type in edges:
        session.add(KnowledgeEdge(source_id=source, target_id=target, edge_type=edge_type))
    session.commit()
    return session


def belongs(source, target):
    return (source, target, EdgeType.belongs_to)


def relates(source, target):
    return (source, target, EdgeType.related_to)


class AncestorsTests(unittest.TestCase):
    def test_a_lone_concept_hangs_from_nothing(self):
        self.assertEqual(ancestors(graph(), {SKILL}), {SKILL})

    def test_a_skill_keeps_the_topic_and_field_above_it(self):
        session = graph(belongs(TOPIC, FIELD), belongs(SKILL, TOPIC))
        self.assertEqual(ancestors(session, {SKILL}), {SKILL, TOPIC, FIELD})

    def test_every_parent_of_a_shared_skill_is_kept(self):
        session = graph(
            belongs(TOPIC, FIELD),
            belongs(OTHER_TOPIC, FIELD),
            belongs(SKILL, TOPIC),
            belongs(SKILL, OTHER_TOPIC),
        )
        self.assertEqual(ancestors(session, {SKILL}), {SKILL, TOPIC, OTHER_TOPIC, FIELD})

    def test_only_belongs_to_holds_a_concept_up(self):
        self.assertEqual(ancestors(graph(relates(SKILL, FIELD)), {SKILL}), {SKILL})

    def test_a_cycle_above_a_concept_does_not_loop_forever(self):
        session = graph(belongs(TOPIC, OTHER_TOPIC), belongs(OTHER_TOPIC, TOPIC))
        self.assertEqual(ancestors(session, {TOPIC}), {TOPIC, OTHER_TOPIC})


class FallingTests(unittest.TestCase):
    def test_a_leaf_takes_nothing_with_it(self):
        owned = {FIELD, TOPIC, SKILL}
        session = graph(belongs(TOPIC, FIELD), belongs(SKILL, TOPIC))
        self.assertEqual(falling(session, SKILL, owned), {SKILL})

    def test_a_topic_takes_its_skills(self):
        owned = {FIELD, TOPIC, SKILL}
        session = graph(belongs(TOPIC, FIELD), belongs(SKILL, TOPIC))
        self.assertEqual(falling(session, TOPIC, owned), {TOPIC, SKILL})

    def test_a_field_takes_everything_under_it(self):
        owned = {FIELD, TOPIC, SKILL, DEEPER}
        session = graph(belongs(TOPIC, FIELD), belongs(SKILL, TOPIC), belongs(DEEPER, SKILL))
        self.assertEqual(falling(session, FIELD, owned), {FIELD, TOPIC, SKILL, DEEPER})

    def test_a_skill_held_by_another_topic_stays(self):
        owned = {FIELD, TOPIC, OTHER_TOPIC, SKILL}
        session = graph(
            belongs(TOPIC, FIELD),
            belongs(OTHER_TOPIC, FIELD),
            belongs(SKILL, TOPIC),
            belongs(SKILL, OTHER_TOPIC),
        )
        self.assertEqual(falling(session, TOPIC, owned), {TOPIC})

    def test_a_root_beside_the_one_going_is_untouched(self):
        owned = {FIELD, OTHER_TOPIC, TOPIC}
        session = graph(belongs(TOPIC, OTHER_TOPIC))
        self.assertEqual(falling(session, FIELD, owned), {FIELD})

    def test_a_cycle_beside_the_one_going_is_untouched(self):
        # Two concepts that belong to each other have no parentless root, and a
        # forget elsewhere must not take the pair down with it.
        owned = {FIELD, TOPIC, OTHER_TOPIC}
        session = graph(belongs(TOPIC, OTHER_TOPIC), belongs(OTHER_TOPIC, TOPIC))
        self.assertEqual(falling(session, FIELD, owned), {FIELD})

    def test_a_cycle_under_the_one_going_falls_with_it(self):
        owned = {FIELD, TOPIC, OTHER_TOPIC}
        session = graph(
            belongs(TOPIC, FIELD),
            belongs(OTHER_TOPIC, TOPIC),
            belongs(TOPIC, OTHER_TOPIC),
        )
        self.assertEqual(falling(session, FIELD, owned), {FIELD, TOPIC, OTHER_TOPIC})

    def test_only_belongs_to_holds_a_concept_up(self):
        owned = {FIELD, TOPIC, SKILL}
        session = graph(belongs(TOPIC, FIELD), belongs(SKILL, TOPIC), relates(SKILL, FIELD))
        self.assertEqual(falling(session, TOPIC, owned), {TOPIC, SKILL})

    def test_a_concept_outside_the_graph_is_not_reached(self):
        owned = {FIELD, TOPIC}
        session = graph(belongs(TOPIC, FIELD), belongs(SKILL, TOPIC))
        self.assertEqual(falling(session, FIELD, owned), {FIELD, TOPIC})


if __name__ == "__main__":
    unittest.main()
