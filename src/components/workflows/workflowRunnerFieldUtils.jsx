/**
 * Utility function to retrieve field values from workflow context
 * Supports step answers, account data, entity data, and controlling person data
 */
export const getFieldValue = (fieldPath, allAnswers, initialData) => {
  if (!fieldPath) return undefined;
  
  console.log(`    [getFieldValue] 🔍 Looking up field path: "${fieldPath}"`);
  console.log(`    [getFieldValue] Available data sources:`, {
    hasAllAnswers: !!allAnswers,
    hasInitialData: !!initialData,
    hasAccount: !!initialData?.account,
    hasEntity: !!initialData?.entity,
    hasControllingPerson: !!initialData?.controlling_person
  });
  
  // First check if it's a step answer reference with sub-field (e.g., "step_id.sub_field")
  if (fieldPath.includes('.')) {
    const [stepId, subField] = fieldPath.split('.');
    const stepAnswer = allAnswers[stepId];
    console.log(`    [getFieldValue] Dot detected - stepId: "${stepId}", subField: "${subField}"`);
    console.log(`    [getFieldValue] Step answer for "${stepId}":`, JSON.stringify(stepAnswer));
    
    if (stepAnswer && typeof stepAnswer === 'object' && !Array.isArray(stepAnswer)) {
      const value = stepAnswer[subField];
      console.log(`    [getFieldValue] ✅ Found "${stepId}.${subField}":`, value, `(type: ${typeof value})`);
      return value;
    } else {
      console.log(`    [getFieldValue] ⚠️ Step answer for "${stepId}" is not an object or doesn't exist`);
    }
  }
  
  // Check step answers first (direct lookup)
  if (allAnswers[fieldPath] !== undefined) {
    console.log(`    [getFieldValue] Direct step answer "${fieldPath}":`, allAnswers[fieldPath]);
    return allAnswers[fieldPath];
  }
  
  // Check Account data (from initialData.account)
  if (initialData?.account) {
    // Handle nested field paths in account data (e.g., "address.country")
    if (fieldPath.includes('.')) {
      const parts = fieldPath.split('.');
      let value = initialData.account;
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) break;
      }
      if (value !== undefined) {
        console.log(`    [getFieldValue] Account nested field "${fieldPath}":`, value);
        return value;
      }
    }
    // Handle direct account field
    if (initialData.account[fieldPath] !== undefined) {
      console.log(`    [getFieldValue] Account field "${fieldPath}":`, initialData.account[fieldPath]);
      return initialData.account[fieldPath];
    }
  }
  
  // Check ControllingPerson data (from initialData.controlling_person)
  if (initialData?.controlling_person) {
    // Handle nested field paths
    if (fieldPath.includes('.')) {
      const parts = fieldPath.split('.');
      let value = initialData.controlling_person;
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) break;
      }
      if (value !== undefined) {
        console.log(`    [getFieldValue] ControllingPerson nested field "${fieldPath}":`, value);
        return value;
      }
    }
    // Handle direct controlling person field
    if (initialData.controlling_person[fieldPath] !== undefined) {
      console.log(`    [getFieldValue] ControllingPerson field "${fieldPath}":`, initialData.controlling_person[fieldPath]);
      return initialData.controlling_person[fieldPath];
    }
  }
  
  // Check Entity data (from initialData.entity)
  if (initialData?.entity) {
    console.log(`    [getFieldValue] Checking entity data for "${fieldPath}"...`);
    console.log(`    [getFieldValue] Entity object:`, JSON.stringify(initialData.entity));
    // Handle nested field paths
    if (fieldPath.includes('.')) {
      const parts = fieldPath.split('.');
      let value = initialData.entity;
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) break;
      }
      if (value !== undefined) {
        console.log(`    [getFieldValue] ✅ Entity nested field "${fieldPath}":`, value, `(type: ${typeof value})`);
        return value;
      }
    }
    // Handle direct entity field
    if (initialData.entity[fieldPath] !== undefined) {
      console.log(`    [getFieldValue] ✅ Entity direct field "${fieldPath}":`, initialData.entity[fieldPath], `(type: ${typeof initialData.entity[fieldPath]})`);
      return initialData.entity[fieldPath];
    }
  }
  
  console.log(`    [getFieldValue] ❌ Field "${fieldPath}" not found in any data source!`);
  console.log(`    [getFieldValue] Returning: undefined`);
  return undefined;
};