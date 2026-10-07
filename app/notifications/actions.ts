"use server";

import { getPermissions } from "@/lib/permissions";
import { getSession } from "@/lib/getSession";
import { broadcastNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/logActivity";
import { Audience, Delivery } from "@/lib/notifications";

export type BroadcastState = {
  success: boolean;
  error?: string | null;
};

export async function sendBroadcast(prevState: BroadcastState, formData: FormData): Promise<BroadcastState> {
  const permissions = await getPermissions();
  if (!permissions.isAdmin && !permissions.isClubManager) {
    return { success: false, error: "You don't have permission to send broadcasts." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const audience = String(formData.get("audience") ?? "") as Audience;
  const delivery = String(formData.get("delivery") ?? "") as Delivery;

  // Validate title (1-120 chars)
  if (title.length < 1 || title.length > 120) {
    return { success: false, error: "Title must be between 1 and 120 characters." };
  }

  // Validate body (1-1000 chars)
  if (body.length < 1 || body.length > 1000) {
    return { success: false, error: "Body must be between 1 and 1000 characters." };
  }

  // Validate audience against allowed enums
  const validAudiences = ["EVERYONE", "COACHES", "PARENTS", "MANAGERS", "AGE_GROUP"];
  if (!validAudiences.includes(audience)) {
    return { success: false, error: "Invalid audience selection." };
  }

  // Validate delivery against allowed enums
  const validDeliveries = ["both", "inApp", "push"];
  if (!validDeliveries.includes(delivery)) {
    return { success: false, error: "Invalid delivery selection." };
  }

  // Get sentById and senderName from session - NEVER from client
  const session = await getSession();
  const sentById = session?.userId ?? "";
  const senderName = session?.name ?? "Admin";

  // Validate ageGroupId when audience is AGE_GROUP
  let ageGroupId: string | undefined = undefined;
  if (audience === "AGE_GROUP") {
    const ageGroupIdRaw = String(formData.get("ageGroupId") ?? "").trim();
    if (!ageGroupIdRaw) {
      return { success: false, error: "Age group is required when selecting AGE_GROUP audience." };
    }
    ageGroupId = ageGroupIdRaw;
    // Verify the age group exists
    const ageGroupExists = await prisma.ageGroup.findUnique({
      where: { id: ageGroupId },
    });
    if (!ageGroupExists) {
      return { success: false, error: "Selected age group does not exist." };
    }
  }

  try {
    const sentCount = await broadcastNotification({
      title,
      body,
      audience,
      ageGroupId,
      delivery,
      sentById,
      senderName,
    });

    // If no active recipients matched that audience
    if (sentCount === null) {
      return { success: false, error: "No active recipients matched that audience." };
    }

    // Log activity
    await logActivity(
      sentById,
      "broadcast_sent",
      "broadcast",
      undefined,
      `Broadcast sent to ${sentCount} recipients`
    );

    return { success: true, error: null };
  } catch (error) {
    console.error("Broadcast failed:", error);
    return { success: false, error: "Failed to send broadcast. Please try again." };
  }
}