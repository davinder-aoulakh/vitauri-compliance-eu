// Shared toggle logic for multi_choice/multiple_choice workflow steps.
// Any option whose label matches "none of the above" (case-insensitive) is treated
// as mutually exclusive with every other option in the same step.
export function isNoneOfTheAboveOption(option) {
  return option?.label?.trim().toLowerCase() === "none of the above";
}

// Given the currently selected values, the clicked option, and the full options list,
// returns the new selected values array applying the exclusivity rule:
// - Clicking "None of the above" clears every other selection, leaving only it selected.
// - Clicking any other option removes "None of the above" (if present) then toggles normally.
export function toggleMultiChoiceValue(selected, clickedOption, options) {
  const isSel = selected.includes(clickedOption.value);

  if (isNoneOfTheAboveOption(clickedOption)) {
    return isSel ? [] : [clickedOption.value];
  }

  const noneOption = options?.find(isNoneOfTheAboveOption);
  const withoutNone = noneOption ? selected.filter(v => v !== noneOption.value) : selected;

  return isSel
    ? withoutNone.filter(v => v !== clickedOption.value)
    : [...withoutNone, clickedOption.value];
}