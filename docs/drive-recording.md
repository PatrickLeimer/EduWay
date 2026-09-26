# Test drives: recording, replaying, tuning

How to record a real drive on the phone and turn it into numbers for tuning and validating the detectors. Read it all once before your first drive; after that, the checklists are enough.

- **On the phone:** Dev menu → **Drive recorder (test drives)**.
- **On the laptop:** `npm run drive-replay -- <file>`.
- **Code:** `apps/mobile/src/recorder/`, `scripts/drive-replay/`.

> **Safety first (master doc §15, §16).** Two people, always. The **driver only drives** and never looks at or touches the phone. The **passenger** runs the recorder. Hard braking, hard starts, sharp turns and swerves happen **only in an empty parking lot**, at low speed, with nobody around. Never drive badly on public roads to "get data". Rolling stops: only at a quiet stop sign with no other cars or pedestrians, and only if you can do it legally and safely; otherwise skip that marker.

---

## 1. What it records

While recording, the phone runs the **real** detectors, the same code a real trip uses (whatever the flags in `wiring.ts` say), and writes one file with:

| Data | Why |
|---|---|
| Raw motion samples, about 50 per second | So the laptop can replay the drive with **different thresholds** |
| Every GPS fix, including the inaccurate ones | Speed, speeding, stop signs, GPS quality |
| Every OpenStreetMap (Overpass) response | So the replay has the same road data, even offline |
| Every event the app detected live | To compare "what the phone did" with "what the replay does" |
| Your **markers** (buttons you tap) | Ground truth: what really happened |
| Your **segments** (which part of the plan you are in) | So the report can split results by baseline, parking lot, and so on |

The file stays on the phone in the app's own storage. It only leaves when you tap **Share**. Motion data must never be uploaded to our server or committed to git (master doc §3, §9); `.gitignore` already ignores `*.ndjson` and `recordings/`.

---

## 2. One-time setup

**Laptop**
1. Pull `main` and run `npm install` at the repo root.
2. Make a folder `recordings/` at the repo root. Recordings go there (git ignores it).

**Phone**
1. Install **Expo Go** (App Store / Play Store).
2. On the laptop: `npm run dev:mobile`, then scan the QR code. Phone and laptop on the same Wi-Fi (or run `npx expo start --tunnel` from `apps/mobile`).
3. In the app: **Dev menu → Drive recorder (test drives)**. You should see "BEFORE YOU START" and a **Start recording** button.

You do **not** need to change `wiring.ts`. The recorder always uses the real sensors and detectors.

> Expo Go loads the app from the laptop's dev server. Once it's open it normally keeps running without the laptop (you may see a "disconnected" banner; ignore it). If Expo Go is closed or reloads, it needs the laptop again, so open the recorder before you leave and don't close Expo Go during the drive.

---

## 3. Before you leave (checklist)

- [ ] **Pick the route** on [openstreetmap.org](https://www.openstreetmap.org): tap a road → the left panel shows its tags. You want roads with a `maxspeed` tag and at least 2–3 stop signs (`highway=stop` nodes; ideally some with a `direction` tag). Note an **empty parking lot** on the way.
- [ ] **Phone charged** (above 70%), **Do Not Disturb** on, auto-lock doesn't matter (the recorder keeps the screen on).
- [ ] **Mount** the phone firmly, on the **passenger side** (vent or dash mount) so the passenger can reach it and the driver can't. A loose phone slides and creates fake events. If you truly have no mount, set Mount to **loose** on the screen; that data is fine for GPS/road checks but poor for tuning motion thresholds.
- [ ] **Mobile data on.** The road data download needs it. (If it fails, motion detection still records fine.)
- [ ] Open **Dev menu → Drive recorder** and tap **Start recording** once while parked to check it works:
  - Allow **Motion** and **Location** when asked.
  - **Motion** line: about **50 Hz**. If it shows "LOW", see Troubleshooting.
  - **GPS** line: accuracy should drop **under 20 m** within a minute outdoors.
  - **Road** line: should show some **ways** within ~30 s. If it shows **Road error** or "failed", road checks won't work on this drive (see Troubleshooting); motion still works.
  - Tap **Stop and save**. That test file can be deleted from the list.
- [ ] Driver and passenger have both read the safety box at the top and the run plan below.

---

## 4. The run plan

Tap **Start recording** once at the beginning and **Stop and save** once at the end: **one file for the whole drive.** As you move through the plan, tap the matching **segment** button ("WHERE ARE WE?"). Tap markers during each part as described.

| # | Segment button | Where | What the driver does | Markers the passenger taps | Time |
|---|---|---|---|---|---|
| 1 | `baseline` (already selected) | Parked, engine on | Nothing. Nobody touches the phone. | none | 2 min |
| 2 | `normal_driving` | Public roads | Drive normally and smoothly | **Normal brake**, **Normal start**, **Normal turn**, **Lane change** as they happen (aim for 5+ of each). **Bump / pothole** for any bump. **Over the limit** if the speedometer is more than 5 mph over the posted limit for 5+ seconds. **App was wrong** if a live event shows up on screen and nothing happened. | 10–15 min |
| 3 | `parking_lot` | **Empty** lot | Each maneuver 3–5 times, with a normal version in between: **firm stop from ~15–20 mph**, **firm start**, **tight turn at 10–15 mph**, and **only if the lot is big and empty**, a quick left-right steer above 25 km/h (16 mph) | The matching marker right after each one: **Hard brake / Normal brake**, **Hard start / Normal start**, **Sharp turn / Normal turn**, **Swerve / Lane change**. Once: passenger picks up the mounted phone, tilts it, puts it back, then taps **Phone moved / touched**. | 10 min |
| 4 | `stop_signs` | Quiet streets with stop signs | Full stop at each sign; one slow roll-through **only if safe and legal** | **Full stop at sign** or **Rolling stop** right after passing the sign | 5–10 min |
| 5 | `other` | Anything else (driving home) | Drive normally | Same as normal driving | any |

**Why the "normal" markers matter as much as the "hard" ones:** a threshold is only good if it sits *above* every normal maneuver and *below* every hard one. Without normal markers you can't tell whether a threshold is too sensitive.

**Doing it on both platforms:** motion axes differ between iPhone and Android. If you can, record a second, shorter drive (baseline + parking lot) on the other kind of phone.

---

## 5. Marker cheat sheet

Tap **right after** the thing happens (within a couple of seconds). One light tap with one finger. The screen shows "last: …" so you can see it registered. Taps a second or two late are fine; the report allows for that.

| Button | Tap when | What the report checks |
|---|---|---|
| Hard brake | A deliberately firm stop (parking lot) | Did the app detect `hard_brake`? |
| Normal brake | An ordinary stop or slow-down | The app did **not** detect `hard_brake` |
| Hard start | A deliberately firm take-off | Did it detect `hard_accel`? |
| Normal start | An ordinary take-off | No `hard_accel` |
| Sharp turn | A deliberately tight, quick turn | Did it detect `rough_turn`? |
| Normal turn | An ordinary turn | No `rough_turn` |
| Swerve | A quick left-right (or right-left) steer | Did it detect `swerve`? |
| Lane change | An ordinary lane change | No `swerve` |
| Bump / pothole | Speed bump, pothole, rough patch | No motion event at all |
| Phone moved / touched | Someone touched or moved the phone | No motion event (the junk filter should pause detection) |
| Full stop at sign | Car fully stopped at a stop sign | No `rolling_stop` |
| Rolling stop | Car rolled through a stop sign | Did it detect `rolling_stop`? |
| Over the limit | 5+ mph over the posted limit for 5+ s | Did it detect `speeding`? |
| App was wrong (false alarm) | The newest event in "DETECTED LIVE" didn't really happen | That event is counted as a false alarm |

Missed a marker? Don't tap late guesses; just move on. A few missing markers only make some events "unconfirmed".

---

## 6. During the drive: reading the screen

| Line | Good | If not |
|---|---|---|
| `RECORDING 12:34 · file 3.1 MB` | Time and size keep going up | If it says ERROR, read the message, tap Stop, and start again |
| `Motion: … 50 Hz` | 45–55 Hz | "LOW": the screen was off or the app left the foreground. Keep the recorder on screen. |
| `(paused: phone moving)` | Only when someone touches the phone | Showing while nobody touches it: the mount is loose |
| `GPS: … accuracy 5 m` | Under 20 m | "TOO LOW": wait before the next maneuver; fixes that inaccurate are ignored |
| `Road: 350 ways, 12 stop signs` | Numbers above 0 | "no data yet" / "Road error": road checks (speeding, rolling stops, street names) won't work on this drive |
| `On: SW 8th St · primary · limit 40 (posted)` | Matches the street you're on | Wrong street = matching problem; note the time |
| `DETECTED LIVE` | Events you expect | Wrong one → tap **App was wrong** |

**Keep the recorder screen open the whole time.** Pressing Home, switching apps, or locking the phone pauses motion recording (the report will flag it). Leaving the recorder screen (for example tapping the in-app **Home** button) **stops and saves** the recording; just start a new one if that happens.

---

## 7. After the drive: getting the file to the laptop

1. Park. Tap **Stop and save**. The message says "Saved drive-YYYYMMDD-HHMMSS-ios.ndjson".
2. Under **SAVED RECORDINGS**, tap **Share** next to it:
   - **iPhone → Mac:** AirDrop.
   - **Any phone:** Save to Google Drive / Files, or email it to yourself (a 20-minute drive is roughly 5–10 MB).
3. Put the file in `recordings/` at the repo root. Keep the original filename.
4. Write a line in your notes next to the filename: phone model, mount, route, anything odd ("hit a big pothole at ~06:30", "passenger missed some lane changes").

Recordings stay on the phone until you tap **Delete**. Delete them once they're safely on the laptop.

---

## 8. Running the report

From the repo root:

```bash
npm run drive-replay -- recordings/drive-20260927-101500-ios.ndjson
```

Save it to a file instead of printing:

```bash
npm run drive-replay -- recordings/drive-20260927-101500-ios.ndjson --out recordings/report-0927.txt
```

The replay takes a few seconds. It uses the recorded road data, so it works offline.

---

## 9. Reading the report

### Section 1: Recording health
Check this first. If the data is bad, the rest is meaningless.

- **Motion Hz** about 50, few gaps. Low Hz or long gaps = screen off or app in background.
- **gravity |accG| median ~9.8 m/s²:** this is the "units verified" check from the weekend plan (§14). If it's far from 9.8, stop and tell WS1.
- **GPS accuracy:** median under 10 m is good. More than 20% of fixes worse than 20 m = results for speeding and stop signs are unreliable.
- **Road:** Overpass fetches `ok` should be at least 1. "fixes matched to a street" should be high (above 80%) on public roads. "limit posted" tells you how much of the route had real speed-limit tags.
- **Noise during baseline:** all three numbers should be well under 2.5. If not, the phone or mount is vibrating a lot.
- Lines starting with `!` are problems to read.

### Section 2: Detection vs your markers
One row per event type:

- **markers / caught / missed:** how many times you said "this should fire", and how many times it did. **Missed = the threshold may be too high** (or the maneuver was gentler than you thought).
- **events:** how many the replay detected.
- **confirmed:** matched a "should fire" marker.
- **false alarm:** fired during a "normal …", bump, or phone-moved marker, or you tapped "App was wrong". **False alarms = the threshold may be too low.**
- **unconfirmed:** fired with no marker nearby. In `baseline` and `normal_driving` these are probably false alarms; in the parking lot they're probably a maneuver you forgot to mark.

Below the table, the report lists every missed marker, false alarm and unconfirmed event with its time, so you can match them to your notes.

### Section 3: Tuning data
**This is the section to tune from.** For every marker it shows the largest filtered signal around it, the same number the thresholds compare against:

```
Hard brake (4): brake m/s² min 2.9 · median 3.6 · max 4.4
  thresholds now: coach ≥ 2.5, harsh ≥ 3.5
Normal brake (9): brake m/s² min 0.8 · median 1.4 · max 2.7
  thresholds now: coach ≥ 2.5, harsh ≥ 3.5
```

Read it like this: normal brakes reached up to **2.7**, above the 2.5 start, so one normal brake probably fired (a false alarm). Hard brakes went down to **2.9**. A threshold between **2.7 and 2.9** would separate them on this drive. Look for the same gap for every pair (hard vs normal brake, hard vs normal start, sharp vs normal turn, swerve vs lane change).

For stop signs it shows the **minimum speed** near each marker. For speeding, the **most mph over the limit**.

### Section 4: Every replayed event
The full list, with time, type, tier, peak, speed, street and verdict.

### "Live" vs "replayed" counts
The phone's live count and the replay count should be about the same. Small differences are normal: live, the road data arrives a few seconds after the start, so the replay can find a couple more road events. If they're very different and you didn't use `--set`, tell WS1/WS2.

---

## 10. Tuning workflow

1. Run the report. Use Section 3 to pick candidate values.
2. **Try them on the recording** without changing any code:
   ```bash
   npm run drive-replay -- recordings/drive-….ndjson --set HARD_BRAKE.coach.start=2.8 --set HARD_BRAKE.harsh.start=3.8
   ```
   `--set` works for any number in these groups of `packages/shared/src/thresholds.ts`: `PIPELINE`, `HARD_BRAKE`, `HARD_ACCEL`, `ROUGH_TURN`, `SWERVE`, `SPEEDING`, `ROLLING_STOP`, `PHONE_USE`, `ROAD`. Write it as `GROUP.path=value`. Examples:
   - `HARD_BRAKE.coach.start=2.8`, `HARD_BRAKE.coach.release=1.8`, `HARD_BRAKE.coach.minDurationS=0.5`
   - `ROUGH_TURN.coach.start=3.5`, `ROUGH_TURN.minHeadingChangeDeg=40`
   - `SWERVE.coach.peakMps2=2.5`, `SWERVE.windowS=2.5`
   - `ROLLING_STOP.maxStopSpeedMph=3`, `ROLLING_STOP.signRadiusM=20`
   - `SPEEDING.minDurationS=8`
   - `PIPELINE.emaAlpha=0.15` (smoothing)

   It changes values **only inside that replay run.**
3. Check the new values on **every** recording you have, not just one. A threshold that only works on one drive isn't tuned.
4. When a value holds up: change it in `packages/shared/src/thresholds.ts` in **its own commit** (it's a protected contract, so tell the team first), e.g. `ws1: tune hard brake thresholds from test drives 09-27`, and put the before/after caught/false-alarm counts in the commit message.
5. Record another drive with the new values to confirm. The report warns when a recording was made with different thresholds than the code now has.

---

## 11. Troubleshooting

| Problem | Fix |
|---|---|
| "Motion permission denied" / "Location permission denied" | Phone Settings → Expo Go → allow Motion & Fitness (iPhone) / Location "While using". Then start again. |
| Motion LOW (well under 50 Hz) | Keep the recorder screen in front and the phone unlocked. If it stays low, try with Low Power Mode / Battery Saver off, and tell WS1 the phone model. |
| Road error "Overpass HTTP 406" / "429" / "504" / timeout | The public Overpass server refused or is overloaded. Motion recording is unaffected. Try again later or on another network; tell WS2 (there is no fallback server yet). |
| GPS accuracy stays above 20 m | Get away from tall buildings and garages; wait a minute with a clear sky. |
| Accidentally left the recorder screen | The recording was saved up to that point. Start a new one; replay each file separately. |
| App crashed | The file is saved up to about 1 s before the crash. The report says "No end line" and works anyway. |
| Share button does nothing | Update Expo Go. Or try a different target (Files / Drive instead of AirDrop). |
| `npm run drive-replay` says "Not a drive recording" | The file got changed in transit (for example email added a .txt ending or changed the text). Rename it back to `.ndjson`, or re-share it via Drive/AirDrop. |
