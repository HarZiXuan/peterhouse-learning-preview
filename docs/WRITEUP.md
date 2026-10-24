# Peterhouse Learning Review: write-up

The Learning Review helps teachers write each child's end-of-semester portfolio. A teacher rates a few short statements about the child in each learning area (for example "Mia counts objects to 10": *Sometimes*, *Regularly*, *Confidently*…), adds a short note, and chooses photos. The system turns that into a warm, written report in the school's style, which the teacher checks, the administrator approves, and the family receives as a printed or PDF keepsake.

This write-up explains what it is built with, how a child's progress is kept from one semester to the next, where the data will live and how it is protected, and the future enhancements we plan.

---

## 1. What it is built with

| Part | What we use | Why |
| --- | --- | --- |
| **The screens teachers use** | **Next.js** (a widely used website framework), with **Tailwind** for styling and **shadcn** for ready-made buttons, tables and forms, in the **Inter** font. The family report uses the Peterhouse fonts and colours. | Pages open quickly on a school tablet or laptop. The report a teacher previews on screen is drawn by exactly the same page that makes the PDF, so what they check is what the family gets. |
| **The engine behind the screens** | **Node.js** with **Express**, written in **TypeScript**. | One small, well-known engine does all the sensitive work in one place: checking who is logged in, deciding who may see what, locking and unlocking data, talking to the AI and making PDFs. |
| **Where ratings, comments and reports are kept** | **PostgreSQL**, a reliable, free database used by banks and governments. | One child, one report per semester, never two. Nothing is overwritten by accident. |
| **Where photos are kept** | Inside the same database, **locked** (encrypted) like everything else. Before saving, each photo is turned upright, made smaller, and stripped of hidden details such as where and when it was taken. | One backup holds everything, and there is no folder of children's photos lying around on the server. Photos are only accepted when the family has given consent. |
| **The writing assistant (AI)** | **Google Gemini** today. It can be switched to OpenAI, or to a model running on the school's own computer. If the AI is unavailable, a built-in "sentence bank" writes the report instead. | Teachers always get a report, even when the internet or the AI service is down. |
| **PDF reports** | The system opens the report page in a hidden browser (Chrome) and "prints" it to an A4 PDF. Chinese fonts are installed on the server itself. | The PDF looks exactly like the preview, and Chinese names and paragraphs always show correctly, even on a brand-new server. |
| **Logging in** | Every staff member has their own account and password, and a role: **Administrator** or **Teacher** (see below). | Everyone is responsible for their own actions, and a teacher can never open a child from another class. |

### Logging in, roles and who can do what

There are no shared passwords. The administrator creates each staff member's account; the new person receives a temporary password and must choose their own the first time they log in.

**Administrator** (for example, the principal or school manager) runs the school's side of the system:

- **Controls staff accounts:** adds new teachers, edits their name, email and role, resets a forgotten password, unlocks an account after too many wrong passwords, and switches off the account of someone who has left, which logs them out everywhere at once.
- **Sets up classes:** creates classes, adds children, and chooses each class's teachers and who writes each learning area.
- **Approves every report:** reads each report as the family will see it, then approves it, sends it back with a note, or takes it over to finish it (for example, when a teacher is away).
- **Runs the school year:** edits the questions teachers answer, keeps the calendar and timetables, and starts the next semester.
- **Sees the activity record:** who logged in, who opened which child's record, and who wrote, approved or downloaded a report.

**Teacher** writes the reports for their own class, and sees nothing else. Within a class, a teacher can be:

- **Lead teacher:** writes the whole report for each child and sends it to the administrator. They can change any part of it.
- **Co-teacher or subject teacher:** writes only the learning areas given to them (for example, the Chinese teacher writes the Chinese area), and sends that part to the lead teacher.

*Example:* Ms Lim is lead teacher of K1 Sunflower and Mr Tan teaches Chinese there. Mr Tan rates the Chinese skills for each child, checks the Chinese paragraph and sends it to Ms Lim. Ms Lim writes the rest of the report around it and sends it to the principal. The principal approves it, and only then can the family's PDF be downloaded. Neither teacher can open a child from K2 Rainbow.

**Extra protection on logging in:** five wrong passwords lock an account for 15 minutes, and anyone inactive for 12 hours is logged out automatically.

### How the AI writes in our style without making things up

Think of the AI as a new teaching assistant who writes well but has never met the child. We give them a style guide and only the teacher's own facts, and the teacher always has the final word.

- **A style guide in plain English.** It describes the school's voice (warm, simple, British spelling, short sentences), how long each paragraph should be, how to talk about each rating, and shows good examples. The school can edit it at any time, with no programming.
- **Only the teacher's facts go in.** The AI sees the ratings, the teacher's short notes, what the child loved most, and the home ideas the teacher picked. Nothing else.
- **Told never to invent.** It is told never to make up an event, place, object or person, and to write less rather than guess. Strong ratings are written as strengths; low ones are written gently; "not seen yet" is never written as a weakness. Families never see numbers.
  *Example:* if the teacher rated "builds towers with blocks" as *Really shines* but wrote no note, the report may say Mia builds tall towers with care. It will not say "Mia built a castle with her friend Sarah last Tuesday".
- **Checked before the teacher sees it.** Every paragraph is checked automatically, and anything doubtful is highlighted for the teacher: a score or number, words such as "weak" or "behind", a comparison with other children, another child's name, or a skill that was never observed.
- **The teacher decides.** The teacher can edit any sentence, or ask for one paragraph again ("make it shorter", "mention her painting"). Nothing reaches a family until the administrator approves it.
- **Chinese in Chinese.** The Chinese (华文) area is asked and written in Chinese.
- **Shared reports.** When a Chinese teacher looks after the Chinese area, they write and check that part and send it to the class's lead teacher. The lead teacher's report keeps that part exactly as the Chinese teacher sent it.

---

## 2. Keeping each child's progress across the year

Portfolios are done twice a year: **Semester 1** (January to June) and **Semester 2** (July to December).

**How it is kept.** Each child has one record. Each semester, that child gets a new, separate report: their ratings, the teacher's notes, the photos, the written report and every earlier draft of it. Starting a new semester never touches the old one. It is like a new page in the same exercise book: the old pages stay as they were.

**What the family sees in Semester 2.** On each learning area page, every statement is listed with the June rating beside the December rating, with a green ↑ where the child has grown and a red ↓ where they have slipped.

> **Mia in Mathematics**
>
> | | June | December |
> | --- | --- | --- |
> | Mia counts objects to 10 | ★★☆☆☆ Sometimes | ★★★★☆ Confidently ↑ |
> | Mia names simple shapes | ★★★☆☆ Regularly | ★★★☆☆ Regularly |
> | Mia sorts things by colour | ★★★★☆ Confidently | ★★★☆☆ Regularly ↓ |

**Why the comparison stays fair:**

- **Questions keep their identity.** If the school rewords "Mia counts to 10" as "Mia counts objects to 10", it is still the same skill, so June and December still line up. If a question is replaced by a different skill, the new one simply shows no June rating, rather than a misleading comparison.
- **Old reports never change.** When a report is approved, a copy of it is frozen exactly as the family received it. If a teacher later leaves, a child's photo is changed, or the school edits its questions, past reports stay exactly as they were sent.
- **No family is missed.** If a semester ends before a report was approved, it can still be finished and approved afterwards.

---

## 3. Where the data will live, and how it is kept safe

### What the school asked for

The school wants to **look after its own children's data**, and not hand it to other companies. The plan below is built around that.

### A private server in Singapore

- **A server of our own, in Singapore.** A dedicated virtual server (DigitalOcean, Singapore region, 2 processors and 4 GB of memory) used only for Peterhouse. Nothing else runs on it, so a problem elsewhere cannot reach it. Keeping it in Singapore keeps the data close to the school and simple to explain under the data protection law (PDPA).
- **Backups in Singapore too.** Every night a full, locked copy of the data is saved, kept for two weeks on the server and also copied to a separate private storage space in Singapore. If the server is lost, everything can be brought back.
- **Expected cost:** about US$25–30 a month for the server and backup storage. Prices change, so this is checked before buying.

### How it is protected, in everyday terms

| What we do | In everyday terms | Example |
| --- | --- | --- |
| **Locked data (encryption)** | Children's names, birthdays, notes, reports and photos are scrambled before they are saved. Only the school's system holds the key to unscramble them. | If someone stole a copy of the database or a backup, they would see meaningless text, not "Mia Tan, born 3 May 2021". |
| **Only two doors open (firewall)** | The server only accepts normal, secure website visits. Everything else is closed. The database cannot be reached from the internet at all. | Like a building where only the front entrance is open, and the records room has no outside door. |
| **Private entrance for maintenance** | Only the developer can log in to look after the server, through a private connection, using a digital key instead of a password. | A stranger who guesses a password still cannot get in. |
| **Secure connection** | Every visit uses the padlock (https), so nothing can be read on the way. | On school or home Wi-Fi, no one nearby can see what a teacher types. |
| **Each person sees only their part** | Teachers see only their own classes, and only change the areas they teach. Only the administrator approves reports. | A Nursery 1 teacher cannot open a Kindergarten 2 child's report. |
| **Lock-outs** | Five wrong passwords lock an account for 15 minutes. | Someone trying to guess a password gets stopped quickly. |
| **A record of who did what** | Every login, opened report, edit, approval and download is recorded. | If a parent asks who looked at their child's report, the school can answer. |
| **Backups that are tested** | Restoring a backup is practised regularly, not just assumed to work. | A backup that has never been restored might not work when it is needed. |
| **Keys kept apart** | The key that unlocks the data is kept separately from the backups, in the school's password manager and an offline copy. | Losing a backup does not mean losing the children's data to someone else. |
| **Updates and alerts** | Security updates install themselves. The developer is alerted if the site goes down, a backup fails, or the server is running out of space. | Problems are found by us, not by a parent. |

**Being honest about "our own server".** A rented server still sits in a data centre owned by another company (here, DigitalOcean). Because everything sensitive is scrambled and the company is bound by contract, the risk is small. If the school wants no outside company involved at all, the system can run on a computer kept at the school, at the cost of looking after that machine (power, internet, repairs, backups).

### What the AI sees, and what it does not

This is the one place where information leaves the school's server, so it needs care.

**The AI never learns who the child is.** Before anything is sent, the system replaces the child's name with "[Child]", other children with "[Friend]" and teachers with "[Teacher]", and removes phone numbers, emails and IC numbers. After the AI replies, the name is put back on the school's own server.

> **What the teacher wrote:** "Mia loved the shape hunt with Aisyah and Ms Lim."
> **What the AI receives:** "[Child] loved the shape hunt with [Friend] and [Teacher]."

So the AI sees ratings and short anonymous notes, with no names, birthdays, photos or class.

**Google does not use it.** We use a paid Gemini business account. Under its terms, Google does not use what we send to train or improve its products. The text is only used to write that one paragraph, and since it carries no names, nothing in it identifies a child or the family.

If the school ever wants nothing at all to leave its server, the writing assistant can be switched to a model running on the school's own computer, or to the built-in sentence bank, without changing anything else.

---

## 4. Future enhancements

**Before real children's data goes in**

1. **Set up the Singapore server** described above, with nightly backups, alerts and a tested restore.
2. **Data protection paperwork (PDPA):** how long reports are kept and when they are deleted, a plan for what to do if data is ever exposed, and a way for a family to ask for a copy of their child's data.
3. **Two-step login** (a code from a phone app) for the administrator first, then all teachers.

**For teachers**

4. **Voice notes:** teachers speak their observations instead of typing, and the system turns them into text, including when they mix English and Chinese in one sentence.
   *Example:* "Mia today 很棒, she counted all the blocks by herself" is written down exactly as said.
5. **Attendance and observation history for each child:** short notes and attendance kept through the semester, so that at report time the teacher has a record to draw on instead of relying on memory.
   *Example:* a note in March, "Mia helped a new friend find the toilet", is there to remind Ms Lim when she writes about Mia in June.
6. **Help with the next semester:** suggestions built from last semester's "next steps", and a view of each child's growth from Playgroup all the way to Kindergarten 2.
7. **Working without internet on tablets:** ratings saved on the tablet and sent when the connection returns, and photos taken straight from the camera, with an option to blur other children's faces.

**For the school's leaders**

8. **Class and year-group insights:** simple charts that show patterns across many children, without singling out any child.
   *Examples:* "Across all K2 classes, Chinese is the area children find hardest this semester", or "K1 Sunflower grew most in Social-Emotional Development between June and December."

**For families**

9. **Sending reports to parents in one click:** connect to a parent portal, or send each family a secure, private link to view and download their child's PDF, instead of emailing attachments. When reports are approved, the administrator presses one button and every family receives theirs, and the school can see who has opened it.
10. **Fully bilingual reports:** the whole report in English and Chinese, chosen per family.

**Behind the scenes**

11. **Automatic safety checks** every time the system is updated, and a one-click way to go back to the previous version if something goes wrong.
12. **Regular restore drills** done automatically each month, with a report to the school.
