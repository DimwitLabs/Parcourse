"""Forgetting one concept takes down whatever only stood on it. A concept that
also belongs to something being kept has somewhere else to hang from, so it
stays where it is rather than being carried off.
"""

import unittest
import uuid
from types import SimpleNamespace

from models.knowledge_graph import EdgeType
from routers.knowledge_graph import _falling


class FakeSession:
    """Stands in for the query in _falling, which asks only for belongs_to."""

    def __init__(self, edges):
        self.edges = [e for e in edges if e.edge_type == EdgeType.belongs_to]

    def exec(self, _statement):
        return SimpleNamespace(all=lambda: self.edges)


def edge(source, target, edge_type=EdgeType.belongs_to):
    return SimpleNamespace(source_id=source, target_id=target, edge_type=edge_type)


FIELD = uuid.uuid4()
TOPIC = uuid.uuid4()
OTHER_TOPIC = uuid.uuid4()
SKILL = uuid.uuid4()
DEEPER = uuid.uuid4()


class FallingTests(unittest.TestCase):
    def test_a_leaf_takes_nothing_with_it(self):
        owned = {FIELD, TOPIC, SKILL}
        session = FakeSession([edge(TOPIC, FIELD), edge(SKILL, TOPIC)])
        self.assertEqual(_falling(session, SKILL, owned), {SKILL})

    def test_a_topic_takes_its_skills(self):
        owned = {FIELD, TOPIC, SKILL}
        session = FakeSession([edge(TOPIC, FIELD), edge(SKILL, TOPIC)])
        self.assertEqual(_falling(session, TOPIC, owned), {TOPIC, SKILL})

    def test_a_field_takes_everything_under_it(self):
        owned = {FIELD, TOPIC, SKILL, DEEPER}
        session = FakeSession([edge(TOPIC, FIELD), edge(SKILL, TOPIC), edge(DEEPER, SKILL)])
        self.assertEqual(_falling(session, FIELD, owned), {FIELD, TOPIC, SKILL, DEEPER})

    def test_a_skill_held_by_another_topic_stays(self):
        owned = {FIELD, TOPIC, OTHER_TOPIC, SKILL}
        session = FakeSession([
            edge(TOPIC, FIELD),
            edge(OTHER_TOPIC, FIELD),
            edge(SKILL, TOPIC),
            edge(SKILL, OTHER_TOPIC),
        ])
        self.assertEqual(_falling(session, TOPIC, owned), {TOPIC})

    def test_a_root_beside_the_one_going_is_untouched(self):
        other_field = uuid.uuid4()
        owned = {FIELD, other_field, TOPIC}
        session = FakeSession([edge(TOPIC, other_field)])
        self.assertEqual(_falling(session, FIELD, owned), {FIELD})

    def test_a_cycle_beside_the_one_going_is_untouched(self):
        # Two concepts that belong to each other have no parentless root, and a
        # forget elsewhere must not take the pair down with it.
        owned = {FIELD, TOPIC, OTHER_TOPIC}
        session = FakeSession([edge(TOPIC, OTHER_TOPIC), edge(OTHER_TOPIC, TOPIC)])
        self.assertEqual(_falling(session, FIELD, owned), {FIELD})

    def test_a_cycle_under_the_one_going_falls_with_it(self):
        owned = {FIELD, TOPIC, OTHER_TOPIC}
        session = FakeSession([
            edge(TOPIC, FIELD),
            edge(OTHER_TOPIC, TOPIC),
            edge(TOPIC, OTHER_TOPIC),
        ])
        self.assertEqual(_falling(session, FIELD, owned), {FIELD, TOPIC, OTHER_TOPIC})

    def test_only_belongs_to_holds_a_concept_up(self):
        owned = {FIELD, TOPIC, SKILL}
        session = FakeSession([
            edge(TOPIC, FIELD),
            edge(SKILL, TOPIC),
            edge(SKILL, FIELD, EdgeType.related_to),
        ])
        self.assertEqual(_falling(session, TOPIC, owned), {TOPIC, SKILL})


if __name__ == "__main__":
    unittest.main()
