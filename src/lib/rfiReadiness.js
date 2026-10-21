export const RFI_NOT_READY_MESSAGE =
  "Please classify the RFI entity first before classifying the account.";

const isBlank = (v) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

// Entity is ready only when rfi_status is set (and not pending) and fi_type is set.
export function isEntityReadyForAccountClassification(entity) {
  if (!entity) return false;
  if (isBlank(entity.rfi_status) || entity.rfi_status === "pending_classification") return false;
  if (isBlank(entity.fi_type)) return false;
  return true;
}