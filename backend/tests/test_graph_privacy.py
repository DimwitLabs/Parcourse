"""Whose courses a graph is allowed to name. A concept is shared by everyone who
has met it, so the courses hanging off one belong to whoever asks rather than to
the concept, and an admin looking at someone else's graph is shown what they know
and not what they have been watching.

These run against a real SQLite session, so the narrowing happens in the query
being tested rather than in a fake standing in for it.
"""

import json
import unittest
import uuid

from sqlalchemy import event
from sqlmodel import Session, create_engine

from models.base import SQLModelBase
from models.course_cache import CachedCourse
from models.knowledge_graph import CourseKnowledgeNode, KnowledgeNode, NodeTier, UserKnowledgeProgress
from models.user import User
from routers.knowledge_graph import _build_graph

BONDS = uuid.uuid4()


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


def session_with_a_shared_concept():
    """Two people who have both met the same concept, each through their own
    course, which is the only arrangement where the leak is visible."""
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

    session.add(KnowledgeNode(id=BONDS, tier=NodeTier.skill, label="Bonds", description=""))
    session.flush()

    for owner, title in ((alice, "Alice's course"), (bob, "Bob's course")):
        course = CachedCourse(
            user_id=owner.id,
            video_id=title[:8],
            course_json=json.dumps(a_course_named(title, title[:8])),
        )
        session.add(course)
        session.flush()
        session.add(CourseKnowledgeNode(course_id=course.id, node_id=BONDS))
        session.add(UserKnowledgeProgress(user_id=owner.id, node_id=BONDS, mastery_score=0.5))

    session.commit()
    return session, alice, bob


def titles(graph):
    return sorted(course.title for node in graph.nodes for course in node.courses)


class GraphNamesOnlyYourOwnCourses(unittest.TestCase):
    def test_your_graph_names_the_course_you_took(self):
        session, alice, _ = session_with_a_shared_concept()
        self.assertEqual(titles(_build_graph(session, alice.id)), ["Alice's course"])

    def test_a_shared_concept_does_not_name_someone_elses_course(self):
        session, alice, _ = session_with_a_shared_concept()
        self.assertNotIn("Bob's course", titles(_build_graph(session, alice.id)))

    def test_the_narrowing_runs_both_ways(self):
        session, _, bob = session_with_a_shared_concept()
        self.assertEqual(titles(_build_graph(session, bob.id)), ["Bob's course"])


class AdminSeesTheConceptsAndNotTheCourses(unittest.TestCase):
    def test_an_admin_view_names_no_courses_at_all(self):
        session, alice, _ = session_with_a_shared_concept()
        self.assertEqual(titles(_build_graph(session, alice.id, with_courses=False)), [])

    def test_an_admin_view_still_carries_the_concept(self):
        session, alice, _ = session_with_a_shared_concept()
        graph = _build_graph(session, alice.id, with_courses=False)
        self.assertEqual([node.label for node in graph.nodes], ["Bonds"])

    def test_an_admin_view_still_carries_mastery(self):
        session, alice, _ = session_with_a_shared_concept()
        graph = _build_graph(session, alice.id, with_courses=False)
        self.assertEqual(graph.nodes[0].mastery_score, 0.5)


if __name__ == "__main__":
    unittest.main()
