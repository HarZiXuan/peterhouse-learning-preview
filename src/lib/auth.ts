import { workspace } from "./workspace";
import type { User } from "./types";

// There are no sign-ins: the app runs on the school computer for the
// teachers. Every action is recorded against one built-in user.
export async function currentUser(): Promise<User> {
  return workspace().user;
}
export const requireUser = currentUser;
