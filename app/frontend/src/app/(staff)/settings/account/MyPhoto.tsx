"use client";

import { ProfilePhoto } from "@/components/ProfileForm";

/** Your own photo, shown in the people lists next to your name. */
export function MyPhoto({ userId, photo, name }: { userId: number; photo: string | null; name: string }) {
  return (
    <div className="-mx-6">
      <ProfilePhoto endpoint={`/api/users/${userId}/photo`} photo={photo} name={name} />
    </div>
  );
}
