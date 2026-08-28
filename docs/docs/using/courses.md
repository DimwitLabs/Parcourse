---
id: courses
title: Courses
---

# Courses

A course is a video reorganised into something you can work through.

:::note[Attribution]
A video belongs to whoever made it. Parcourse does not host, mirror or re-upload anything, and it claims none of it. The video plays from YouTube in YouTube's own player, so watching it inside a course is watching it on YouTube, and the course around it is written from the transcript that already came with it.

So if a video taught you something, go and subscribe to the person who made it, and support them with likes, comments and, if possible, direct donations, or however else they have asked to be supported. All Parcourse does is help you retain and understand what they taught you.
:::

## Making One

Paste a YouTube link into the bar on the home screen. Parcourse fetches the transcript, hands it to your model, and gets back a set of sections. Each section has a title, a summary, the takeaways worth keeping, and the point in the video it starts at.

Only YouTube links are accepted, and the check happens as you paste rather than when you submit. `watch`, `youtu.be`, `shorts`, `embed`, `live` and the mobile and music subdomains all work.

### If the Creator Already Split It

If the creator wrote chapters, Parcourse stops at the transcript step and asks whose division to use. Use theirs and they become the sections, titles and timings kept as written. Regenerate and they are ignored. The question is only asked from two chapters up.

Either way, chapters that sell rather than teach are dropped, judged by what is said across them rather than by their titles. That can leave gaps between sections, which is intended.

Generating a course takes a while, and you wait on it: the request is not done until the sections are. The cheatsheet is the part that is not blocking. It is queued once the course is saved and written after the page has already come back, so it fills in behind you.

## Working Through One

Each section can be marked done. Progress is per section and per person, so two people on the same instance keep their own.

A timestamp on a section opens the video at that moment.

A tab at the right edge opens [your notes](/using/notes) for the course, which stay open while the video plays.

### The Nudge at the End of a Section

The video pauses rather than crossing into the next section unannounced, and a card offers that section's questions or dismisses itself. Leave it and it answers itself: the button drains as it counts down, then playback resumes.

Dragging the scrubber past a boundary skips the stop. The card follows the video into fullscreen, which is why the fullscreen button is Parcourse's own, above the seek bar.

## The Notebook

Every course you have made is in the notebook. Above the cards there is a search bar and two controls in the header:

- Sort: by newest, oldest, title, or how far through you are.
- Filter: to what has not been started, what is underway, or what is finished.

Search looks at everything a course holds, not just the title: section titles and summaries, the takeaways, and the quiz questions. So a course can be found by something said inside it rather than by what it is called.

## Regenerating and Deleting

A course can be regenerated, which throws away the sections and asks the model again. Use it when the split is wrong rather than when a single summary is weak.

Deleting a course removes its sections, its progress, its quiz attempts, its [notes](/using/notes) and its cheatsheet. It also prunes the concepts it contributed to your knowledge graph, though anything another course still holds up is kept. Both actions ask first.
