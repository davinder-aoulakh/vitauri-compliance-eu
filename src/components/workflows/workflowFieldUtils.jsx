/**
 * Utility function to get field values for workflow evaluation
 * Supports nested field paths, account data, entity data, and answer overrides
 */
export const getFieldValue = (fieldPath, account, linkedEntity, answers, answersOverride = null) => {
  const answersToUse = answersOverride || answers;
  
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

  if (account?.[fieldPath] !== undefined) {
    return account[fieldPath];
  }

  if (linkedEntity?.[fieldPath] !== undefined) {
    return linkedEntity[fieldPath];
  }

  return null;
};