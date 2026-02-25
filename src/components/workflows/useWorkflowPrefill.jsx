import { useEffect } from "react";

export const useWorkflowPrefill = ({
  account,
  latestAccountData,
  workflow,
  answers,
  setAnswers,
  linkedEntity,
  crsCountryMap
}) => {
  useEffect(() => {
    if (account && !answers._account_data_loaded && workflow) {
      const currentAccount = latestAccountData || account;
      console.log('[PREFILL] Using account data:', currentAccount);

      const preFillAnswers = {
        _account_data_loaded: true,
        _is_pre_existing: currentAccount.is_pre_existing,
        _account_holder_is_alive: currentAccount.account_holder_is_alive,
        _account_holder_type: currentAccount.account_holder_type
      };

      workflow.steps.forEach(step => {
        if (step.mapped_field?.entity_type === "Account" && step.mapped_field?.field_name) {
          const fieldName = step.mapped_field.field_name;
          let fieldValue = currentAccount[fieldName];
          console.log(`[PREFILL] Step "${step.step_title}": field=${fieldName}, value="${fieldValue}"`);

          if (fieldValue !== undefined && fieldValue !== null && fieldValue !== "") {
            if (step.question_type === 'yes_no' && step.mapped_field.prefill_config) {
              const prefillType = step.mapped_field.prefill_config.prefill_type;

              if (prefillType === 'country_crs') {
                const normalizedCountry = String(fieldValue).toLowerCase();
                const countryInfo = crsCountryMap[normalizedCountry];
                if (countryInfo) {
                  preFillAnswers[step.step_id] = countryInfo.isCrs ? 'YES' : 'NO';
                  console.log(`[PREFILL] country_crs: ${fieldValue} -> ${countryInfo.isCrs ? 'YES' : 'NO'}`);
                }
              } else if (prefillType === 'enum_match') {
                const matchValues = step.mapped_field.prefill_config.match_values || [];
                const isMatch = matchValues.includes(String(fieldValue));
                preFillAnswers[step.step_id] = isMatch ? 'YES' : 'NO';
                console.log(`[PREFILL] enum_match: fieldValue="${fieldValue}", matchValues=${JSON.stringify(matchValues)}, isMatch=${isMatch} -> ${isMatch ? 'YES' : 'NO'}`);
              }
            }
            else if (step.question_type === 'yes_no' && typeof fieldValue === 'boolean') {
              preFillAnswers[step.step_id] = fieldValue ? 'YES' : 'NO';
            } else if (step.question_type === 'multiple_choice' && Array.isArray(fieldValue)) {
              preFillAnswers[step.step_id] = fieldValue.join(',');
            } else if (step.question_type === 'address_input' && typeof fieldValue === 'object') {
              preFillAnswers[step.step_id] = {
                ...fieldValue,
                _address_config: step.address_config || { target_field: "current_address", track_changes: true }
              };
            } else if (step.question_type === 'date_input') {
              preFillAnswers[step.step_id] = String(fieldValue);
            } else if (step.question_type === 'number_input') {
              preFillAnswers[step.step_id] = String(fieldValue);
            } else {
              preFillAnswers[step.step_id] = String(fieldValue);
            }
          }
        }

        if (step.mapped_field?.entity_type === "Entity" && step.mapped_field?.field_name && linkedEntity) {
          const fieldName = step.mapped_field.field_name;
          let fieldValue = linkedEntity[fieldName];
          
          if (fieldValue !== undefined && fieldValue !== null && fieldValue !== "") {
            if (step.question_type === 'yes_no' && typeof fieldValue === 'boolean') {
              preFillAnswers[step.step_id] = fieldValue ? 'YES' : 'NO';
            } else if (step.question_type === 'single_choice') {
              const stringValue = String(fieldValue);
              let matchingOption = step.options?.find(opt => opt.value === stringValue);
              
              if (!matchingOption) {
                matchingOption = step.options?.find(opt => 
                  opt.label?.toLowerCase() === stringValue.toLowerCase()
                );
              }
              
              if (matchingOption) {
                preFillAnswers[step.step_id] = matchingOption.value;
              }
            } else if (step.question_type === 'date_input') {
              preFillAnswers[step.step_id] = String(fieldValue);
            } else if (step.question_type === 'number_input') {
              preFillAnswers[step.step_id] = String(fieldValue);
            } else {
              preFillAnswers[step.step_id] = String(fieldValue);
            }
          }
        }

        if (step.question_type === 'yes_no' && step.mapped_field?.field_name) {
          const fieldName = step.mapped_field.field_name;
          let countryValue = null;

          if (step.mapped_field.entity_type === "Account") {
            if (fieldName === 'current_address.country') {
              countryValue = account?.current_address?.country;
            } else if (fieldName === 'account_holder_address.country') {
              countryValue = account?.account_holder_address?.country;
            } else if (fieldName === 'country_of_residence') {
              countryValue = account?.country_of_residence;
            } else if (fieldName === 'place_of_birth') {
              countryValue = account?.place_of_birth;
            }
          }
          else if (step.mapped_field.entity_type === "Entity" && linkedEntity) {
            if (fieldName === 'country_of_incorporation') {
              countryValue = linkedEntity?.country_of_incorporation;
            } else if (fieldName === 'address.country') {
              countryValue = linkedEntity?.address?.country;
            }
          }

          if (countryValue) {
            const normalizedCountry = String(countryValue).toLowerCase();
            const countryInfo = crsCountryMap[normalizedCountry];

            if (countryInfo) {
              preFillAnswers[step.step_id] = countryInfo.isCrs ? 'YES' : 'NO';
            }
          }
        }
      });

      console.log('[PREFILL] Final pre-fill answers:', preFillAnswers);
      setAnswers(prev => ({ ...prev, ...preFillAnswers }));
    }
  }, [account, workflow, latestAccountData, crsCountryMap, linkedEntity, answers._account_data_loaded, setAnswers]);
};