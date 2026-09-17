"""A field that turns out to be part of a broader one becomes a topic under it.
Nothing it held is lost: mastery stays on the concept, its courses still reach
it, and the topics that hung from it move up to the broader field.

These run against a real SQLite session, so the queries are covered rather than
restated by a fake.
"""

import unittest

from sqlalchemy import event
from sqlmodel import Session, create_engine, select

from models.base import SQLModelBase
from models.course_cache import CachedCourse
from models.knowledge_graph import CourseKnowledgeNode, EdgeType, KnowledgeEdge, KnowledgeNode, NodeTier
from models.user import User
from services.knowledge_graph import demote


def a_graph_with_stock_valuation_as_a_field():
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

    owner = User(email="owner@example.com", hashed_password="x")
    session.add(owner)
    session.flush()
    field = KnowledgeNode(user_id=owner.id, tier=NodeTier.field, label="Stock Valuation", mastery_score=0.7)
    topic = KnowledgeNode(user_id=owner.id, tier=NodeTier.topic, label="Discounted Cash Flow")
    course = CachedCourse(user_id=owner.id, video_id="v", course_json="{}")
    session.add_all([field, topic, course])
    session.flush()
    session.add(KnowledgeEdge(source_id=topic.id, target_id=field.id, edge_type=EdgeType.belongs_to))
    session.add(CourseKnowledgeNode(course_id=course.id, node_id=field.id))
    session.commit()
    return session, owner, field, topic, course


def edges(session):
    labels = {n.id: n.label for n in session.exec(select(KnowledgeNode)).all()}
    return {
        (labels[e.source_id], labels[e.target_id], e.edge_type)
        for e in session.exec(select(KnowledgeEdge)).all()
    }


def node(session, label):
    return session.exec(select(KnowledgeNode).where(KnowledgeNode.label == label)).one()


class DemotingAField(unittest.TestCase):
    def test_it_becomes_a_topic_under_the_broader_field(self):
        session, owner, *_ = a_graph_with_stock_valuation_as_a_field()
        demote(session, owner.id, "Stock Valuation", "Finance")
        self.assertIs(node(session, "Stock Valuation").tier, NodeTier.topic)
        self.assertIs(node(session, "Finance").tier, NodeTier.field)
        self.assertIn(("Stock Valuation", "Finance", EdgeType.belongs_to), edges(session))

    def test_it_keeps_its_mastery_and_its_courses(self):
        session, owner, field, _, course = a_graph_with_stock_valuation_as_a_field()
        demote(session, owner.id, "Stock Valuation", "Finance")
        self.assertEqual(node(session, "Stock Valuation").mastery_score, 0.7)
        self.assertIsNotNone(session.get(CourseKnowledgeNode, (course.id, field.id)))

    def test_its_topics_move_up_to_the_broader_field(self):
        session, owner, *_ = a_graph_with_stock_valuation_as_a_field()
        demote(session, owner.id, "Stock Valuation", "Finance")
        found = edges(session)
        self.assertIn(("Discounted Cash Flow", "Finance", EdgeType.belongs_to), found)
        self.assertIn(("Discounted Cash Flow", "Stock Valuation", EdgeType.related_to), found)
        self.assertNotIn(("Discounted Cash Flow", "Stock Valuation", EdgeType.belongs_to), found)

    def test_a_topic_of_the_same_name_absorbs_it(self):
        session, owner, _, _, course = a_graph_with_stock_valuation_as_a_field()
        twin = KnowledgeNode(user_id=owner.id, tier=NodeTier.topic, label="Stock Valuation", mastery_score=0.3)
        session.add(twin)
        session.commit()
        demote(session, owner.id, "Stock Valuation", "Finance")
        survivors = session.exec(select(KnowledgeNode).where(KnowledgeNode.label == "Stock Valuation")).all()
        self.assertEqual([n.id for n in survivors], [twin.id])
        self.assertEqual(survivors[0].mastery_score, 0.7)
        self.assertIsNotNone(session.get(CourseKnowledgeNode, (course.id, twin.id)))

    def test_an_unknown_field_changes_nothing(self):
        session, owner, *_ = a_graph_with_stock_valuation_as_a_field()
        self.assertIsNone(demote(session, owner.id, "Accounting", "Finance"))
        self.assertEqual(len(session.exec(select(KnowledgeNode)).all()), 2)

    def test_a_field_is_never_demoted_under_itself(self):
        session, owner, *_ = a_graph_with_stock_valuation_as_a_field()
        self.assertIsNone(demote(session, owner.id, "Stock Valuation", "Stock Valuation"))
        self.assertIs(node(session, "Stock Valuation").tier, NodeTier.field)

    def test_someone_elses_field_is_out_of_reach(self):
        session, _, *_ = a_graph_with_stock_valuation_as_a_field()
        stranger = User(email="stranger@example.com", hashed_password="x")
        session.add(stranger)
        session.commit()
        self.assertIsNone(demote(session, stranger.id, "Stock Valuation", "Finance"))
        self.assertIs(node(session, "Stock Valuation").tier, NodeTier.field)


if __name__ == "__main__":
    unittest.main()
