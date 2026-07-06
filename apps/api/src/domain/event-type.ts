import type { EventType } from "@calendar-planner/shared";

const EVENT_TYPES: EventType[] = ["focus", "meeting", "personal", "errand"];

function isValidEventType(value: string): value is EventType {
  return EVENT_TYPES.includes(value as EventType);
}

/**
 * Map a Google Calendar eventType and an optional privately stored domain type
 * to a domain EventType.
 *
 * A privately stored type (from extendedProperties) takes precedence, so
 * app-created events keep the type the Owner assigned even when Google does
 * not have a matching native eventType.
 */
export function mapGoogleEventType(
  googleEventType?: string | null,
  privateEventType?: string | null,
): EventType {
  if (privateEventType && isValidEventType(privateEventType)) {
    return privateEventType;
  }

  switch (googleEventType) {
    case "focusTime":
      return "focus";
    case "outOfOffice":
      return "personal";
    case "workingLocation":
      return "meeting";
    default:
      return "meeting";
  }
}
