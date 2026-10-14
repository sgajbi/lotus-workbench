"use client";

import { useImperativeHandle, useMemo, type Ref } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";

import { FieldLabel, SectionBlock, SemanticBadge } from "@/design-system";
import { formatTimestampValue } from "@/design-system/utils/financial-formatters";

import {
  buildReportOrderingFormSchema,
  REPORT_CURRENCY_FORM_ERROR,
  REPORT_DATE_FORM_ERROR,
  REPORT_REQUIRED_EVIDENCE_FORM_ERROR,
  type ReportOrderingFormValues,
} from "../report-ordering-form";
import {
  isAdvisorCommentarySection,
  type ReportOrderingConfiguration,
  type ReportOrderingViewModel,
} from "../view-model";
import {
  REPORT_ADVISOR_BRIEF_ACTION,
  REPORT_COMMENTARY_RECHECK_ACTION,
} from "../report-ordering-terminology";
import styles from "../report-ordering-workspace.module.css";

export type ReportConfigurationPanelHandle = {
  validate: () => Promise<boolean>;
};

type ReportConfigurationPanelProps = {
  model: ReportOrderingViewModel;
  configuration: ReportOrderingConfiguration;
  disabled: boolean;
  updateConfiguration: (patch: Partial<ReportOrderingConfiguration>) => void;
  toggleSection: (sectionId: string) => void;
  advisorBriefHref: string;
  refreshAvailability: () => void;
  ref?: Ref<ReportConfigurationPanelHandle>;
};

export function ReportConfigurationPanel({
  model,
  configuration,
  disabled,
  updateConfiguration,
  toggleSection,
  advisorBriefHref,
  refreshAvailability,
  ref,
}: ReportConfigurationPanelProps) {
  const configurationFields = new Map(
    model.family?.configurationFields.map((field) => [field.fieldId, field]) ??
      [],
  );
  const currencyField = configurationFields.get("reporting_currency");
  const allocationField = configurationFields.get("allocation_dimensions");
  const sourceBoundTextFieldIds = new Set(
    (model.family?.sections ?? [])
      .filter(isAdvisorCommentarySection)
      .flatMap((section) => section.dependencyFieldIds),
  );
  const textFields = (model.family?.configurationFields ?? []).filter(
    (field) => {
      if (field.inputType !== "text") return false;
      if (sourceBoundTextFieldIds.has(field.fieldId)) return false;
      if (field.requirement !== "conditional") return true;
      return (model.family?.sections ?? []).some(
        (section) =>
          configuration.selectedSections.includes(section.sectionId) &&
          section.dependencyFieldIds.includes(field.fieldId),
      );
    },
  );
  const selectedSectionCount = model.sectionChoices.filter(
    (section) => section.selected,
  ).length;
  const schema = useMemo(
    () =>
      buildReportOrderingFormSchema({
        family: model.family,
        selectedSections: configuration.selectedSections,
        sourceContext: model.sourceContext,
      }),
    [configuration.selectedSections, model.family, model.sourceContext],
  );
  const form = useForm<ReportOrderingFormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    reValidateMode: "onChange",
    shouldFocusError: true,
    values: {
      asOfDate: configuration.asOfDate,
      reportingCurrency: configuration.reportingCurrency,
      configurationValues: configuration.configurationValues,
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      validate: async () =>
        await form.trigger(undefined, { shouldFocus: true }),
    }),
    [form],
  );

  return (
    <div className={styles.configurationStack}>
      <SectionBlock
        title="Approved report"
        subtitle="Available choices are maintained by Reporting and filtered for your role."
        className={styles.section}
      >
        <fieldset className={styles.choiceFieldset}>
          <legend className={styles.srOnly}>Select an approved report</legend>
          <div className={styles.familyGrid}>
            {model.eligibleFamilies.map((family) => {
              const selected = family.reportFamilyId === configuration.familyId;
              return (
                <label
                  key={family.reportFamilyId}
                  className={`${styles.choiceCard} ${selected ? styles.choiceCardSelected : ""}`}
                >
                  <input
                    type="radio"
                    name="report-family"
                    value={family.reportFamilyId}
                    checked={selected}
                    disabled={disabled}
                    onChange={() =>
                      updateConfiguration({ familyId: family.reportFamilyId })
                    }
                  />
                  <span className={styles.choiceBody}>
                    <span className={styles.choiceHeading}>
                      <strong>{family.businessLabel}</strong>
                      <SemanticBadge
                        tone={
                          family.availability.state === "ready"
                            ? "success"
                            : "warn"
                        }
                      >
                        {family.availability.state === "ready"
                          ? "Available"
                          : "Available with limits"}
                      </SemanticBadge>
                    </span>
                    <span>{family.description}</span>
                    <small>{family.availability.message}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {model.workflowManagedFamilies.length ? (
          <div className={styles.workflowManagedGroup}>
            <div className={styles.workflowManagedHeading}>
              <div>
                <strong>Created through business workflows</strong>
                <p>
                  These evidence packs are created from their originating
                  advisory or portfolio-management process, rather than ordered
                  here.
                </p>
              </div>
              <SemanticBadge>Workflow generated</SemanticBadge>
            </div>
            <div className={styles.workflowManagedGrid}>
              {model.workflowManagedFamilies.map((family) => (
                <article
                  key={family.reportFamilyId}
                  className={styles.workflowManagedCard}
                >
                  <strong>{family.businessLabel}</strong>
                  <span>{family.description}</span>
                  <small>
                    {family.orderingModes[0]?.description ??
                      "Open the originating business workflow to create this evidence."}
                  </small>
                </article>
              ))}
            </div>
          </div>
        ) : null}
        {model.nonOrderableFamilies.length ? (
          <div className={styles.workflowManagedGroup}>
            <div className={styles.workflowManagedHeading}>
              <div>
                <strong>Reports not orderable here</strong>
                <p>Reporting publishes these report details without a supported ordering action in Report centre.</p>
              </div>
              <SemanticBadge tone="warn">Not orderable here</SemanticBadge>
            </div>
            <div className={styles.workflowManagedGrid}>
              {model.nonOrderableFamilies.map((family) => (
                <article key={family.reportFamilyId} className={styles.workflowManagedCard}>
                  <strong>{family.businessLabel}</strong>
                  <span>{family.description}</span>
                  <small>{family.availability.message}</small>
                  <span>No report creation or workbook download is available here.</span>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </SectionBlock>

      {model.family ? <>
      <SectionBlock
        title="Report setup"
        subtitle="Set the business date and portfolio-level reporting context."
        className={styles.section}
      >
        <div className={styles.fieldGrid}>
          <div className={styles.fieldGroup}>
            <FieldLabel htmlFor="report-ordering-as-of-date">
              Report date
            </FieldLabel>
            <Controller
              control={form.control}
              name="asOfDate"
              render={({ field, fieldState }) => (
                <>
                  <input
                    id="report-ordering-as-of-date"
                    name={field.name}
                    value={field.value}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={`${styles.fieldInput} workbench-input`}
                    type="date"
                    min={model.sourceContext.earliestReportDate}
                    max={model.sourceContext.latestReportDate}
                    disabled={disabled}
                    onChange={(event) => {
                      field.onChange(event);
                      updateConfiguration({ asOfDate: event.target.value });
                    }}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.error
                        ? "report-ordering-as-of-help report-ordering-as-of-error"
                        : "report-ordering-as-of-help"
                    }
                  />
                  <small id="report-ordering-as-of-help">
                    Available from {model.sourceContext.earliestReportDate} to{" "}
                    {model.sourceContext.latestReportDate}, as confirmed by the
                    portfolio record.
                  </small>
                  <FieldError
                    id="report-ordering-as-of-error"
                    visible={Boolean(fieldState.error)}
                  >
                    {REPORT_DATE_FORM_ERROR}
                  </FieldError>
                </>
              )}
            />
          </div>
          {currencyField ? (
            <div className={styles.fieldGroup}>
              <FieldLabel htmlFor="report-ordering-currency">
                {currencyField.businessLabel}
              </FieldLabel>
              <Controller
                control={form.control}
                name="reportingCurrency"
                render={({ field, fieldState }) => (
                  <>
                    <select
                      id="report-ordering-currency"
                      name={field.name}
                      value={field.value}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      className={`${styles.fieldInput} workbench-input`}
                      disabled={
                        disabled ||
                        model.sourceContext.reportingCurrencies.length === 0
                      }
                      onChange={(event) => {
                        field.onChange(event);
                        updateConfiguration({
                          reportingCurrency: event.target.value,
                        });
                      }}
                      aria-invalid={fieldState.invalid}
                      aria-describedby={
                        fieldState.error
                          ? "report-ordering-currency-help report-ordering-currency-error"
                          : "report-ordering-currency-help"
                      }
                    >
                      {model.sourceContext.reportingCurrencies.map(
                        (currency) => (
                          <option key={currency} value={currency}>
                            {currency}
                          </option>
                        ),
                      )}
                    </select>
                    <small id="report-ordering-currency-help">
                      Choices are confirmed by the portfolio reporting controls.
                    </small>
                    <FieldError
                      id="report-ordering-currency-error"
                      visible={Boolean(fieldState.error)}
                    >
                      {REPORT_CURRENCY_FORM_ERROR}
                    </FieldError>
                  </>
                )}
              />
            </div>
          ) : null}
          {textFields.map((fieldDefinition) => {
            const fieldId = `report-ordering-field-${fieldDefinition.fieldId}`;
            const helpId = `${fieldId}-help`;
            const errorId = `${fieldId}-error`;
            return (
              <div key={fieldDefinition.fieldId} className={styles.fieldGroup}>
                <FieldLabel htmlFor={fieldId}>
                  {fieldDefinition.businessLabel}
                </FieldLabel>
                <Controller
                  control={form.control}
                  name={`configurationValues.${fieldDefinition.fieldId}`}
                  render={({ field, fieldState }) => (
                    <>
                      <input
                        id={fieldId}
                        name={field.name}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={`${styles.fieldInput} workbench-input`}
                        type="text"
                        value={field.value ?? ""}
                        disabled={disabled}
                        onChange={(event) => {
                          field.onChange(event);
                          updateConfiguration({
                            configurationValues: {
                              ...configuration.configurationValues,
                              [fieldDefinition.fieldId]: event.target.value,
                            },
                          });
                        }}
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.error ? `${helpId} ${errorId}` : helpId
                        }
                      />
                      <small id={helpId}>{fieldDefinition.description}</small>
                      <FieldError
                        id={errorId}
                        visible={Boolean(fieldState.error)}
                      >
                        {REPORT_REQUIRED_EVIDENCE_FORM_ERROR}
                      </FieldError>
                    </>
                  )}
                />
              </div>
            );
          })}
        </div>

        {allocationField?.options.length ? (
          <fieldset className={styles.optionFieldset}>
            <legend>{allocationField.businessLabel}</legend>
            <p>{allocationField.description}</p>
            <div className={styles.checkGrid}>
              {allocationField.options.map((option) => (
                <label key={option.value} className={styles.checkChoice}>
                  <input
                    type="checkbox"
                    checked={configuration.allocationDimensions.includes(
                      option.value,
                    )}
                    disabled={disabled}
                    onChange={() =>
                      updateConfiguration({
                        allocationDimensions:
                          configuration.allocationDimensions.includes(
                            option.value,
                          )
                            ? configuration.allocationDimensions.filter(
                                (value) => value !== option.value,
                              )
                            : [
                                ...configuration.allocationDimensions,
                                option.value,
                              ],
                      })
                    }
                  />
                  <span>{option.businessLabel}</span>
                </label>
              ))}
            </div>
            <small>
              With no selection, Reporting applies the default allocation view
              maintained for this portfolio.
            </small>
          </fieldset>
        ) : null}
      </SectionBlock>

      <SectionBlock
        title="Report contents"
        subtitle={`${selectedSectionCount} of ${model.sectionChoices.length} sections included. Required sections remain selected.`}
        className={styles.section}
      >
        <details
          className={styles.contentDisclosure}
          open={model.readiness.state === "blocked" ? true : undefined}
        >
          <summary className={styles.contentSummary}>
            <span className={styles.contentSummaryCopy}>
              <strong>Review report contents</strong>
              <small>
                Open to tailor optional sections for this client review.
              </small>
            </span>
            <SemanticBadge>{selectedSectionCount} included</SemanticBadge>
          </summary>
          <fieldset className={styles.contentChoices}>
            <legend className={styles.srOnly}>Select report sections</legend>
            <div className={styles.sectionChoiceGrid}>
              {model.sectionChoices.map((section) => {
                const inputId = `report-ordering-section-${section.id.toLowerCase()}`;
                const availabilityId = `${inputId}-availability`;
                return (
                  <div
                    key={section.id}
                    className={`${styles.sectionChoice} ${
                      !section.selectable ? styles.choiceCardDisabled : ""
                    }`}
                    data-accepted-brief-run-id={section.acceptedBrief?.runId}
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={section.selected}
                      disabled={
                        disabled || section.required || !section.selectable
                      }
                      onChange={() => toggleSection(section.id)}
                      aria-describedby={
                        section.availabilityDetail ? availabilityId : undefined
                      }
                    />
                    <label htmlFor={inputId} className={styles.choiceBody}>
                      <span className={styles.choiceHeading}>
                        <strong>{section.label}</strong>
                        {section.required ? (
                          <SemanticBadge>Required</SemanticBadge>
                        ) : null}
                        {section.availabilityLabel ? (
                          <SemanticBadge
                            tone={section.acceptedBrief ? "success" : "warn"}
                          >
                            {section.availabilityLabel}
                          </SemanticBadge>
                        ) : null}
                      </span>
                      <span>{section.detail}</span>
                      {section.availabilityDetail ? (
                        <small id={availabilityId}>
                          {section.availabilityDetail}
                        </small>
                      ) : null}
                      {section.acceptedBrief ? (
                        <small>
                          Accepted by {section.acceptedBrief.reviewedBy} on{" "}
                          {formatTimestampValue(
                            section.acceptedBrief.reviewedAt,
                            { nullDisplay: "Review time unavailable" },
                          )}
                          .
                        </small>
                      ) : null}
                      {section.dependencyLabels.length ? (
                        <small>
                          Uses{" "}
                          {section.dependencyLabels.join(" and ").toLowerCase()}
                          .
                        </small>
                      ) : null}
                    </label>
                    {section.recovery === "advisor_brief" ? (
                      <Link
                        className={styles.sectionRecovery}
                        href={advisorBriefHref}
                      >
                        {REPORT_ADVISOR_BRIEF_ACTION}
                      </Link>
                    ) : section.recovery === "refresh" ? (
                      <button
                        className={styles.sectionRecovery}
                        type="button"
                        disabled={disabled}
                        onClick={refreshAvailability}
                      >
                        {REPORT_COMMENTARY_RECHECK_ACTION}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </fieldset>
        </details>
      </SectionBlock>

      <SectionBlock
        title="Output"
        subtitle="Data readiness and governed-document readiness are assessed independently."
        className={styles.section}
      >
        <fieldset className={styles.choiceFieldset}>
          <legend className={styles.srOnly}>Select report output</legend>
          <div className={styles.outputGrid}>
            {model.outputChoices.map((output) => (
              <label
                key={output.id}
                className={`${styles.choiceCard} ${
                  configuration.outputFormat === output.id
                    ? styles.choiceCardSelected
                    : ""
                } ${!output.available ? styles.choiceCardDisabled : ""}`}
              >
                <input
                  type="radio"
                  name="report-output"
                  value={output.id}
                  checked={configuration.outputFormat === output.id}
                  disabled={disabled || !output.available}
                  onChange={() =>
                    updateConfiguration({ outputFormat: output.id })
                  }
                />
                <span className={styles.choiceBody}>
                  <span className={styles.choiceHeading}>
                    <strong>{output.label}</strong>
                    <SemanticBadge tone={output.available ? "success" : "warn"}>
                      {output.available ? "Available" : "Unavailable"}
                    </SemanticBadge>
                  </span>
                  <span>{output.detail}</span>
                  <small>{output.supportReason}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </SectionBlock>
      </> : null}
    </div>
  );
}

function FieldError({
  id,
  visible,
  children,
}: {
  id: string;
  visible: boolean;
  children: string;
}) {
  return visible ? (
    <small id={id} className={styles.fieldError}>
      {children}
    </small>
  ) : null;
}
