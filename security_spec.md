# Security Specification: Firestore Rules

This document specifies the security requirements, data invariants, and negative test cases ("Dirty Dozen") for the Firestore database in the Brackenfell Gas app.

## 1. Data Invariants

1. **Authentication Required**: No user (even authenticated) should be able to read or write another user's chat session or edit global/system components.
2. **Session Ownership**: A chat session belongs to the user who created it.
3. **Structured Messages**: Messages must be added to a session only by appending to the array using an update action that maintains data structure.
4. **No Arbitrary Fields**: No extra or undocumented properties can be injected.
5. **No Negative or Spoofed Identities**: Users cannot register or create sessions claiming to be other users (e.g. matching admin UIDs).

## 2. The "Dirty Dozen" Payloads

Here are 12 payloads representing malicious writes that must be rejected:

1. **Unauthenticated Session Creation**: Attempting to create a chat session without being logged in.
2. **Session Creation with Spoofed Owner**: Creating a session where `userDetails.email` is someone else's email.
3. **Session Read of Another User**: Attempting to fetch/get a session created by another user.
4. **Session List/Query Injection**: Querying all sessions without filtering by owner email/UID.
5. **Admin Spoofing**: Attempting to write or update a user's role to 'admin' in a profile or session.
6. **Shadow Update Gate Bypass**: Adding a "ghost field" like `isAdmin: true` to the session payload.
7. **Message History Erasure**: Updating a session to empty out the `messages` array or delete past conversations.
8. **Invalid Content Type**: Sending a message where the role is something other than `user` or `assistant`.
9. **Junk Character Session ID**: Attempting to create a session document using a massive or invalid document ID (ID poisoning).
10. **Zero-Timestamp Write**: Providing a future or invalid client-side timestamp instead of the server timestamp.
11. **Session Deletion**: Attempting to delete a chat session (sessions should be immutable/write-only after creation).
12. **PII Collection Query**: Querying the private or sensitive details without matching authentication.

## 3. The Security Rules Draft

The draft rules should handle these assertions with robust validation helpers.
