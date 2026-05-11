/**
 * Utility function to get field values for workflow evaluation
 * Supports nested field paths, account data, entity data, and answer overrides
 */
// Map display-name labels used by the workflow builder UI to actual data field paths
const DISPLAY_NAME_MAP = {
  // Account address fields
  'current address country': 'current_address.country',
  'current address street': 'current_address.street',
  'current address city': 'current_address.city',
  'current address state': 'current_address.state',
  'current address postal code': 'current_address.postal_code',
  'account holder address country': 'account_holder_address.country',
  // Entity fields
  'country of incorporation': 'country_of_incorporation',
  'entity name': 'entity_name',
  'entity type': 'entity_type',
  'rfi status': 'rfi_status',
  'fi type': 'fi_type',
};

export const getFieldValue = (fieldPath, account, linkedEntity, answers, answersOverride = null) => {
  const answersToUse = answersOverride || answers;

  // Resolve display-name labels first (case-insensitive)
  const displayMapped = DISPLAY_NAME_MAP[fieldPath?.toLowerCase?.()];
  if (displayMapped) {
    // Recurse with the resolved real field path
    return getFieldValue(displayMapped, account, linkedEntity, answers, answersOverride);
  }

  if (fieldPath.includes('.')) {
    const parts = fieldPath.split('.');
    const stepAnswer = answersToUse[parts[0]];
    if (stepAnswer && typeof stepAnswer === 'object') {
      return stepAnswer[parts[1]];
    }
    if (parts[0] === 'account_holder_address' || parts[0] === 'current_address') {
      return account?.[parts[0]]?.[parts[1]];
    }
    if (linkedEntity && parts[0] === 'entity') {
      return linkedEntity[parts[1]];
    }
    return null;
  }

  if (answersToUse[fieldPath] !== undefined) {
    return answersToUse[fieldPath];
  }

  if (fieldPath === '_is_pre_existing' || fieldPath === 'is_pre_existing') {
    return account?.is_pre_existing;
  } else if (fieldPath === '_account_holder_is_alive' || fieldPath === 'account_holder_is_alive') {
    return account?.account_holder_is_alive;
  } else if (fieldPath === '_account_holder_type' || fieldPath === 'account_holder_type') {
    return account?.account_holder_type;
  } else if (fieldPath === 'country_of_residence') {
    return account?.country_of_residence;
  } else if (fieldPath === 'place_of_birth') {
    return account?.place_of_birth;
  }

  // Fields that live on Entity, not Account — always prefer linkedEntity for these
  const ENTITY_PRIMARY_FIELDS = [
    'country_of_incorporation', 'entity_name', 'entity_type',
    'rfi_status', 'fi_type', 'non_reporting_reason',
  ];

  if (ENTITY_PRIMARY_FIELDS.includes(fieldPath)) {
    const entityVal = linkedEntity?.[fieldPath];
    if (entityVal !== undefined && entityVal !== null && entityVal !== '') return entityVal;
    // Fall back to account only if entity has no value
    const accountVal = account?.[fieldPath];
    if (accountVal !== undefined && accountVal !== null && accountVal !== '') return accountVal;
    return entityVal ?? accountVal ?? null;
  }

  if (account?.[fieldPath] !== undefined) {
    return account[fieldPath];
  }

  if (linkedEntity?.[fieldPath] !== undefined) {
    return linkedEntity[fieldPath];
  }

  return null;
};