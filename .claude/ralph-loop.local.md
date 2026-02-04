---
active: true
iteration: 1
max_iterations: 20
completion_promise: "DONE"
started_at: "2026-02-04T08:35:18Z"
---

Task: Perform a full application health check, logic validation, and export a buildable APK.
Steps:1. Integrity Audit: Scan all core screens (Map, QuickStart, SOS, Settings, etc.) for any missing imports, undefined variables, or broken navigation links.
2. Logic Validation: Verify the Firebase connection, SQLite initialization, and Location tracking logic. Ensure the background sync service is correctly configured.3. Build Preparation: Ensure all Android dependencies are resolved and the local.properties/gradle configurations are correct.
4. APK Generation: - Execute ./gradlew assembleDebug (for a quick testable APK) or ./gradlew assembleRelease if signing is configured.
- If build errors occur, automatically analyze the logs, fix the issues, and retry.
5. Delivery: Once successful, provide the absolute file path to the generated APK and a brief summary of the apps health.Constraint: Do not stop until an APK is successfully generated or a critical unfixable blocker is identified. Refactor code
