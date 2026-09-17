"""Every graph belongs to one person. Two people who study the same subject each
get their own concept, with their own mastery, named after their own courses,
and the model building one graph is never shown the labels in another.

These run against a real SQLite session, so the narrowing happens in the query
being tested rather than in a fake standing in for it.
"""

import json
import unittest

from sqlalchemy import event
from sqlmodel import Session, create_engine

from models.base import SQLModelBase
from models.course_cache import CachedCourse
from models.knowledge_graph import CourseKnowledgeNode, KnowledgeNode, NodeTier
from models.user import User
from routers.knowledge_graph import _build_graph
from services.knowledge_graph import _existing_labels


def a_course_named(title: str, video_id: str) -> dict:
    """What the app actually stores: a whole CourseResponse, not the two fields
    the graph happens to read."""
    return {
        "video_id": video_id,
        "video_title": title,
        "thumbnail_url": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
        "sections": [
            {
                "title": f"{title} section",
                "summary": "",
                "start_seconds": 0.0,
                "end_seconds": 60.0,
                "mcqs": [],
                "theory_questions": [],
            }
        ],
    }


def two_people_studying_bonds():
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

    alice = User(email="alice@example.com", hashed_password="x")
    bob = User(email="bob@example.com", hashed_password="x")
    session.add(alice)
    session.add(bob)
    session.flush()

    for owner, title, mastery in ((alice, "Alice's course", 0.5), (bob, "Bob's course", 0.9)):
        course = CachedCourse(
            user_id=owner.id,
            video_id=title[:8],
            course_json=json.dumps(a_course_named(title, title[:8])),
        )
        node = KnowledgeNode(user_id=owner.id, tier=NodeTier.skill, label="Bonds", mastery_score=mastery)
        session.add(course)
        session.add(node)
        session.flush()
        session.add(CourseKnowledgeNode(course_id=course.id, node_id=node.id))

    session.add(KnowledgeNode(user_id=bob.id, tier=NodeTier.field, label="Finance"))
    session.commit()
    return session, alice, bob


def titles(graph):
    return sorted(course.title for node in graph.nodes for course in node.courses)


class EachPersonHasTheirOwnGraph(unittest.TestCase):
    def test_your_graph_names_the_course_you_took(self):
        session, alice, _ = two_people_studying_bonds()
        self.assertEqual(titles(_build_graph(session, alice.id)), ["Alice's course"])

    def test_the_same_label_is_a_separate_concept_for_each_person(self):
        session, alice, bob = two_people_studying_bonds()
        alices = _build_graph(session, alice.id).nodes
        bobs = [n for n in _build_graph(session, bob.id).nodes if n.label == "Bonds"]
        self.assertNotEqual(alices[0].id, bobs[0].id)

    def test_mastery_is_your_own(self):
        session, alice, bob = two_people_studying_bonds()
        self.assertEqual(_build_graph(session, alice.id).nodes[0].mastery_score, 0.5)
        bobs = [n for n in _build_graph(session, bob.id).nodes if n.label == "Bonds"]
        self.assertEqual(bobs[0].mastery_score, 0.9)

    def test_someone_elses_concepts_stay_out_of_your_graph(self):
        session, alice, _ = two_people_studying_bonds()
        self.assertEqual([n.label for n in _build_graph(session, alice.id).nodes], ["Bonds"])

    def test_the_model_only_sees_your_own_labels(self):
        session, alice, _ = two_people_studying_bonds()
        self.assertNotIn("Finance", _existing_labels(session, alice.id))


class AdminSeesTheConceptsAndNotTheCourses(unittest.TestCase):
    def test_an_admin_view_names_no_courses_at_all(self):
        session, alice, _ = two_people_studying_bonds()
        self.assertEqual(titles(_build_graph(session, alice.id, with_courses=False)), [])

    def test_an_admin_view_still_carries_mastery(self):
        session, alice, _ = two_people_studying_bonds()
        graph = _build_graph(session, alice.id, with_courses=False)
        self.assertEqual(graph.nodes[0].mastery_score, 0.5)


if __name__ == "__main__":
    unittest.main()
