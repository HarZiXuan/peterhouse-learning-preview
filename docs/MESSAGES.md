# Peterhouse Learning Review: Messages

Every action a person can take, and what the screen says back. Use this list to check wording with the school, and add a
row whenever a new action is built.

## Kinds of message

| Kind | Looks like | Used for |
|---|---|---|
| **Pop-up** | A small box in the bottom-right corner that fades after a few seconds. Green tick for success, red for a problem. | The result of a button: saved, added, moved, removed. |
| **On the page** | A box at the top of the page, or a line beside the control. Stays until you leave. | Form problems you need to fix, a result after the page reloads, autosave status. |
| **Confirm box** | A box in the middle of the screen that asks "Are you sure?" before anything happens. | Anything that cannot be undone, or that signs someone out. |

Problems always show the server's own reason (the "If it fails" column lists the common ones), so the message says what
to do, not just "Error".

---

## Signing in

| Action | Who | Success | If it fails | Kind |
|---|---|---|---|---|
| Sign in | Everyone | Goes to their home page | "That email or password is not right." / "Too many wrong attempts. Please wait a few minutes and try again." | On the page |
| First sign-in: choose a password | Everyone | Goes to their home page | "The two new passwords are not the same." / "Your current password is not right." / "Choose a password you have not used just now." | On the page |
| Log out | Everyone | Sign-in page says "You are signed out." | (none) | On the page |

## Classes (admin)

| Action | Success | If it fails | Kind |
|---|---|---|---|
| New class | "K1 Sunflower is ready. Add its teachers and children next." | "There is already a class with that name this semester." / "Please give the class a name." | Pop-up (problems also on the form) |
| Rename class | "Renamed to K1 Sunflower." | Same as above | Pop-up |
| Change a class's level | "K1 Sunflower is now a K2 class." | "A class can only change level while it has no children. Move them to another class first." | Pop-up |
| Remove class | Confirm box: "Remove K1 Sunflower? The class has no children, so nothing else is lost." Then "K1 Sunflower removed." | "Move or remove every child in this class first, including children marked as left." | Confirm box, then pop-up |
| Save teachers | "Teachers saved for K1 Sunflower. They see its children from now on." With nobody chosen: "K1 Sunflower has no teacher now. Only administrators see it." | "Only active teacher accounts can be placed in a class." | Pop-up |
| Add a child | "Mia is in K1 Sunflower." | "Please enter their birthday: it sets their level." / "By their birthday this child is N2 in 2026, so they can only join an N2 class." / "There is no N2 class yet. Create one on the Classes page first." | Pop-up (problems on the form) |
| Edit a child | "Saved." With a birthday of another level: "Saved, and Mia moved to N2 Rainbow." | "By their birthday this child is N2 in 2026, so they can only join an N2 class." | Pop-up |
| Move a child | "Mia moved to K1 Rainbow." | "By their birthday this child is K1 in 2026, so they can only join a K1 class." | Pop-up |
| Mark as left the school | "Mia is marked as left. Their reports are kept." | (server reason) | Pop-up |
| Return to class | "Mia is back in K1 Sunflower." | (server reason) | Pop-up |
| Remove a child | Confirm box: "Remove Mia? This deletes Mia and every report of theirs. It cannot be undone. If they left the school, mark them as left instead." Then "Mia and their reports are removed." | (server reason) | Confirm box, then pop-up |
| Class over its teacher ratio | Warning on the class: "Over the teacher ratio by 2. Add a co-teacher or move a child." | n/a | On the page |
| Child needs a level check | Yellow box on Classes: "2 children need a level check", with each child and the reason | n/a | On the page |

## People and sign-ins (admin)

| Action | Success | If it fails | Kind |
|---|---|---|---|
| Add a person (teacher) | "Added. Give them the temporary password, then place them in a class on the Classes page." | "There is already an account with that email." / password too short | Pop-up |
| Add a person (admin) | "Added. Give them the temporary password; they choose their own at first sign-in." | Same as above | Pop-up |
| Edit a person | "Ms Lim saved." With a new email: "Ms Lim saved. They sign in with lim@school.sg from now on." | "There is already an account with that email." / "You cannot deactivate or demote your own account." | Pop-up |
| Reset password | "Password reset for Ms Lim." | Password too short | Pop-up |
| Unlock | "Ms Lim can sign in again." | (server reason) | Pop-up |
| Deactivate | Confirm box: "Deactivate Ms Lim? They are signed out at once and cannot sign in. Everything they wrote is kept, and you can reactivate them later." (plus which classes will show without them). Then "Ms Lim is deactivated and signed out." | "You cannot deactivate or demote your own account." | Confirm box, then pop-up |
| Reactivate | "Ms Lim can sign in again." | (server reason) | Pop-up |

## Settings

| Action | Who | Success | If it fails | Kind |
|---|---|---|---|---|
| Save report details | Admin | "Saved." | "Those details could not be saved." | On the page |
| Report details | Teacher | "Only an administrator can change these. Ask them if something printed on the reports needs updating." | n/a | On the page |
| Change password (My account) | Everyone | "Password changed. Your other devices have been signed out." | "The two new passwords are not the same." / "Your current password is not right." | On the page |
| Start next semester | Admin | Confirm box: "Start the next semester now? The current semester will be closed. This cannot be undone." Then "Semester 2 2026 is closed. Welcome to the new semester." | "The next semester has already been started." | Confirm box, then on the page |

## A child's review (teachers and admin)

| Action | Success | If it fails | Kind |
|---|---|---|---|
| Tap a rating, write a comment | "Saving…" then "Saved just now" at the top. No pop-up, so tapping stays quiet. | "Could not save. Check your connection." | On the page |
| Add or change the Chinese name | "Chinese name saved." / "Chinese name removed." | (server reason), and the old name comes back | Pop-up |
| Add photos | "Photo added to English." / "2 photos added to Maths." Without consent: "…They stay in the app until parents agree to photos." | "That file is not a photo we can read. Use a JPG or PNG." / "Up to 3 photos for each learning area." | Pop-up (problems on the page) |
| Remove a photo | "Photo removed." | (server reason) | Pop-up |
| Tick or untick photo consent | "Photo consent saved. The report shows the photos." / "Photo consent removed. The report shows initials instead of photos." | (server reason), and the tick goes back | Pop-up |
| Write report | "Report written. Read it through and change anything that needs it." Then the report opens. | "This review is not ready yet. Finish the readiness check first." or the writing service's problem | Pop-up (problems on the page) |

## A child's report (teachers and admin)

| Action | Success | If it fails | Kind |
|---|---|---|---|
| Save a paragraph | "“English” saved." and "Saved ✓" beside it | (server reason) | Pop-up and on the page |
| Write a paragraph again | "“English” written again. Read it through before sending." | (server reason) | Pop-up and on the page |
| Download PDF | "Making Mia Tan’s PDF…" while it is made, then "Mia Tan’s PDF is downloaded." | "The PDF could not be made." (or the server's reason) | Pop-up |

## Questions (admin)

Every change is to the draft, so each message ends with "Teachers see it once you publish."

| Action | Success | If it fails | Kind |
|---|---|---|---|
| Add a question (with its levels) | "Question added." | "Put {name} where the child's name goes…" / "English already has 6 questions for K2, the most allowed. Retire one for K2 first." / "Choose at least one level for this question." | Pop-up and beside the control |
| Change the wording | "Wording changed." Or, when it measures something new: "Saved as a new question." | "Keep a question under … characters." | Pop-up and beside the control |
| Move up or down | "Moved up." / "Moved down." | (server reason) | Pop-up |
| Retire a question | "Question retired. Past reports keep it; new reviews will not ask it." | "English needs at least 3 questions. Add another before retiring this one." | Pop-up and beside the control |
| Bring a question back | "Question brought back." | "English already has 6 questions. Retire one first." | Pop-up and beside the control |
| Save the short-answer question or home ideas | "Question saved." / "Home ideas saved." | "Keep at least one idea to try at home." | Pop-up and beside the control |
| Change a question's levels (tap a level chip) | "Asked at N1, N2, K1, K2. Teachers see it once you publish." | "Mathematics needs at least 3 questions for PG. Add another for PG first." / "English already has 6 questions for K2, the most allowed." / "Choose at least one level. To stop asking it altogether, retire the question." | Pop-up and beside the control |
| Discard changes | Confirm box first. Then "Changes discarded. The draft is back to the published questions." | (server reason) | Confirm box, then pop-up |
| Publish | "Version 4 published. New reviews use it from now on." | "There are no changes to publish." / what still needs fixing | Pop-up and on the page |

---

## Sending reports for review (changes 1 and 3)

| Action | Who | Success | If it fails | Kind |
|---|---|---|---|---|
| Submit for review | Teacher | "Mia’s report is sent for review." | "Write the report before sending it for review." / "Check English first: the ratings changed after it was written." | Pop-up |
| Take back | Teacher | "Taken back. Change what you need, then submit it again." | "Only a report waiting for review can be taken back." | Pop-up |
| Submit again (after changes) | Teacher | "Mia’s report is sent for review." | Same as Submit | Pop-up |
| Approve | Admin | "Mia’s report is approved. It can now be downloaded for the family." | "Only a report waiting for review can be approved." | Pop-up |
| Request changes | Admin | "Sent back to Ms Lim with your note." The teacher then sees "Changes requested", the note in quotes, who wrote it and when. | "Write a short note so the teacher knows what to change." | Dialog, then pop-up |
| Take over | Admin | Confirm box: "Edit Mia’s report yourself? For the last-minute case… Staff will see “edited by admin”… Families never see this." Then "You are editing Mia’s report. Approve it when it is ready." | "This report is approved. Send it back first if something must change." | Confirm box, then pop-up |
| Download PDF before approval | Everyone | "The PDF for families can be downloaded once the report is approved." | n/a | Pop-up |
| Change ratings, photos or wording while locked | Everyone | A note at the top says why: "This report is waiting for review. Take it back to change something." / "An administrator has taken this report over…" / "This report is approved. An administrator can send it back…" Tapping a rating repeats it as a pop-up. | n/a | On the page and pop-up |
| Start next semester with reports not approved | Admin | "3 reports are not approved yet: 1 waiting for review, 2 not sent yet. If you start the next semester now they can still be finished and approved afterwards: pick the semester on Reports." | n/a | On the page |
| Approvals with nothing waiting | Admin | "All caught up. Nothing is waiting. Reports appear here when a teacher sends one for review." With a link: "See the 2 not sent yet". | n/a | On the page |
| Search Approvals with no match | Admin | "No one matches. Try a different name or clear the filters." | n/a | On the page |

---

## Calendar (change 5)

| Action | Who | Success | If it fails | Kind |
|---|---|---|---|---|
| Add an entry | Admin | "“Sports Day” added for the whole school on 14 Nov." (or for K1 and K2, or for the classes chosen) | "Give the entry a title." / "The end date is before the start date." / "Give both a start and an end time, or neither for all day." / "Choose at least one level." / "Choose at least one class." | Dialog, then pop-up |
| Change an entry | Admin | "“Sports Day” saved." | Same as Add | Dialog, then pop-up |
| Remove an entry | Admin | Confirm box: "Remove “Sports Day”? It disappears from the app and from everyone’s linked calendar the next time it refreshes." Then "“Sports Day” removed." | (server reason) | Confirm box, then pop-up |
| Copy calendar link | Everyone | "Link copied. Paste it where your calendar app asks to subscribe by URL." | n/a | Pop-up |
| Reset calendar link | Everyone | Confirm box: "Reset your calendar link? … The old link stops working at once…" Then "New link ready. Add it to your calendar again; the old one has stopped working." | "The link could not be reset." | Confirm box, then pop-up |
| Calendar on this computer | Everyone | "This copy runs on this computer, so Google and Outlook cannot reach it. The buttons work on the school’s server." | n/a | On the page |
| An old or wrong calendar link | Google / Outlook | The link answers "This calendar link is not valid. Open Calendar in the Learning Review for your current link." | n/a | (in the calendar app) |
| Nothing coming up | Teacher | "Nothing special in the next seven days." on the Class page | n/a | On the page |

---

## Subjects and timetable (change 7)

| Action | Who | Success | If it fails | Kind |
|---|---|---|---|---|
| Add a subject | Admin | "Music added. Add it to a class on the Timetable page." | "There is already a subject with that name." / "Give the subject a name." | Pop-up |
| Save a subject | Admin | "Music saved." | Same as above | Pop-up |
| Hide / show a subject | Admin | "Music is hidden. It stays on today’s timetables but cannot be added to new lessons." / "Music can be added to lessons again." | (server reason) | Pop-up |
| Remove a subject | Admin | Confirm box: "Remove Music? It is on no timetable, so nothing else changes." Then "Music removed." | "This subject is on a timetable. Hide it instead, or remove its lessons first." | Confirm box, then pop-up |
| Add or change a lesson | Admin, subject teacher | "Maths added: Wednesday, 10:30–11:15." / "Maths saved: …" | "It overlaps English (9:00–9:45) in this class." / "Times go in 5-minute steps, like 9:05 or 9:10." / "The lesson ends before it starts." / "You can change only your own lessons of the subjects you teach in this class. Ask the administrator for anything else." | Dialog, then pop-up |
| Teacher booked twice | Admin | The lesson is saved, then a warning: "This teacher is also teaching K1 Rainbow then (9:00–9:45)." | n/a | Pop-up (warning) |
| Remove a lesson | Admin, subject teacher | Confirm box: "Remove this Maths lesson? Wednesday, 10:30–11:15, every week." (for a subject teacher: "If it is your last lesson in this class, you stop seeing its children.") Then "Maths on Wednesday removed." | (server reason) | Confirm box, then pop-up |
| Copy a timetable | Admin | "Copied to K1 Rainbow, K1 Star." | "Choose at least one other class." | Dialog, then pop-up |
| Rate an area that is not theirs | Subject teacher | Note at the top: "You teach Chinese 华文 to this class, so you rate Chinese 华文 and can add its photos. The class teachers rate the other areas and write the report." Tapping another area: "You rate Chinese for this class. Its class teachers rate the rest." | n/a | On the page and pop-up |
| Add a subject teacher | Admin | "george now teaches Maths in MiaoMeow." | "This teacher is already the class's lead or co-teacher, so they teach every subject here." | Dialog, then pop-up |
| Change a subject teacher's subjects | Admin | "george’s subjects in MiaoMeow are saved." With none ticked, the button reads "Remove from class". | "Choose subjects from the school's subject list." | Dialog, then pop-up |
| Remove a subject teacher | Admin | "george removed from MiaoMeow. Their lessons here now have no teacher." | n/a | Pop-up |
| Name someone outside the class on a lesson | Admin | n/a | "Choose one of this class's teachers. Add a subject teacher to the class on its Classes page first." | Pop-up |

---

## Fixes from the 23 Oct 2026 review

| Action | Who | Success | If it fails | Kind |
| --- | --- | --- | --- | --- |
| Add a photo without photo consent | Teacher | On the page instead of the photo boxes: "No photo consent from Mia’s parents, so photos cannot be added and none print. An administrator records consent on the child’s profile." | "This child's parents have not given photo consent, so no photos can be added. An administrator records consent on the child's profile." | On the page / pop-up |
| Record photo consent | Admin | Tick "Parents gave photo consent." when adding the child, or under Edit on the profile. The profile shows "Photo consent: Yes / No". | n/a | Dialog |
| A paragraph whose ratings changed | Teacher | Under the paragraph: "The ratings changed after this was written. Read it again, then save it or write this part again." Saving the teacher's own edit clears it. | Submit: "Check English first: the ratings changed after it was written." | On the page |
| What the checks found | Teacher, admin | Under the paragraph, one line each, e.g. "Contains a number (“3”). Check this is a concrete count, not a score." | n/a | On the page |
| Write or submit with a statement unrated | Teacher | n/a | "Some statements are not rated yet. Rate each one, or mark it Not seen yet, first." | Pop-up |
| Hand back a report taken over | Admin | "Mia’s report is back with the teacher." | "This report is with its teacher already." | Pop-up |
| Switch semester | Admin | The confirm box adds: "Its reports that are not approved yet can still be finished and approved: pick the semester on Reports." | n/a | Confirm box |

## Still to write (for changes not built yet)

These will be added when their change is built (see `CHANGES-TO-MAKE.md`; built changes are in `BUILT.md`).

| Change | Action | Planned message |
|---|---|---|
| Now (lead and co-teachers) | Two teachers change the same area of a child at the same time | Today the later save wins with no warning. Planned: "Ms Tan changed English for Mia a moment ago. Reload to see her answers before you change them." Not built yet: it needs the server to notice the clash, which none of the five changes covered. |
