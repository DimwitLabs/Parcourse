---
id: courses
title: Courses
---

# Courses

A course is a video reorganised into something you can work through.

## Making One

Paste a YouTube link into the bar on the home screen. Parcourse fetches the transcript, hands it to your model, and gets back a set of sections. Each section has a title, a summary, the takeaways worth keeping, and the point in the video it starts at.

Only YouTube links are accepted, and the check happens as you paste rather than when you submit. `watch`, `youtu.be`, `shorts`, `embed`, `live` and the mobile and music subdomains all work.

Generating a course takes a while, and you wait on it: the request is not done until the sections are. The cheatsheet is the part that is not blocking. It is queued once the course is saved and written after the page has already come back, so it fills in behind you.

## Working Through One

Each section can be marked done. Progress is per section and per person, so two people on the same instance keep their own.

A timestamp on a section opens the video at that moment.

## The Notebook

Every course you have made is in the notebook. Above the cards there is a search bar and two controls in the header:

- Sort: by newest, oldest, title, or how far through you are.
- Filter: to what has not been started, what is underway, or what is finished.

Search looks at everything a course holds, not just the title: section titles and summaries, the takeaways, and the quiz questions. So a course can be found by something said inside it rather than by what it is called.

## Regenerating and Deleting

A course can be regenerated, which throws away the sections and asks the model again. Use it when the split is wrong rather than when a single summary is weak.

Deleting a course removes its sections, its progress and its quiz attempts. It also prunes the concepts it contributed to your knowledge graph, though anything another course still holds up is kept. Both actions ask first.
