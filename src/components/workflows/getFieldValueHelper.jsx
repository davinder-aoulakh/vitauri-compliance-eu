/**
 * Helper to safely extract field values including multi-field sub-fields
 */
export const createGetFieldValue = (answers, account, linkedEntity) => {
  return (fieldPath) => {
    console.log(`  🔎 [getFieldValue] Looking up: "${fieldPath}"`);
    
    if (fieldPath.includes('.')) {
      const parts = fieldPath.split('.');
      console.log(`     → Detected dotted path: parts = [${parts.join(', ')}]`);
      
      const stepAnswer = answers[parts[0]];
      console.log(`     → Answer for step "${parts[0]}":`, stepAnswer, `(type: ${typeof stepAnswer})`);
      
      if (stepAnswer && typeof stepAnswer === 'object' && !Array.isArray(stepAnswer)) {
        const value = stepAnswer[parts[1]];
        console.log(`     → Sub-field "${parts[1]}" value:`, value, `(type: ${typeof value})`);
        return value;
      }
      
      if (parts[0] === 'account_holder_address' || parts[0] === 'current_address') {
        const value = account?.[parts[0]]?.[parts[1]];
        console.log(`     → Account address field "${parts[0]}.${parts[1]}":`, value);
        return value;
      }
      
      if (linkedEntity && parts[0] === 'entity') {
        const value = linkedEntity[parts[1]];
        console.log(`     → Entity field "${parts[1]}":`, value);
        return value;
      }
      
      console.log(`     → No match found, returning null`);
      return null;
    }

    if (answers[fieldPath] !== undefined) {
      console.log(`     → Direct answer lookup: "${fieldPath}" =`, answers[fieldPath]);
      return answers[fieldPath];
    }

    if (fieldPath === '_is_pre_existing' || fieldPath === 'is_pre_existing') {
      console.log(`     → Account is_pre_existing:`, account?.is_pre_existing);
      return account?.is_pre_existing;
    } else if (fieldPath === '_account_holder_is_alive' || fieldPath === 'account_holder_is_alive') {
      console.log(`     → Account account_holder_is_alive:`, account?.account_holder_is_alive);
      return account?.account_holder_is_alive;
    } else if (fieldPath === '_account_holder_type' || fieldPath === 'account_holder_type') {
      console.log(`     → Account account_holder_type:`, account?.account_holder_type);
      return account?.account_holder_type;
    } else if (fieldPath === 'country_of_residence') {
      console.log(`     → Account country_of_residence:`, account?.country_of_residence);
      return account?.country_of_residence;
    } else if (fieldPath === 'place_of_birth') {
      console.log(`     → Account place_of_birth:`, account?.place_of_birth);
      return account?.place_of_birth;
    }

    if (account?.[fieldPath] !== undefined) {
      console.log(`     → Account field "${fieldPath}":`, account[fieldPath]);
      return account[fieldPath];
    }

    if (linkedEntity?.[fieldPath] !== undefined) {
      console.log(`     → Entity field "${fieldPath}":`, linkedEntity[fieldPath]);
      return linkedEntity[fieldPath];
    }

    console.log(`     → Field not found anywhere, returning null`);
    return null;
  };
};