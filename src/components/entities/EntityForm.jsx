import React from "react";
import DynamicFormRenderer from "../forms/DynamicFormRenderer";

export default function EntityForm({ entity, onSubmit, onCancel }) {
  return (
    <DynamicFormRenderer
      entityType="Entity"
      initialData={entity}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
}