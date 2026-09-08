import type { applyAdvisoryCopilotCallerContextHeaders } from "@/features/advisory-copilot/caller-context";
import type { applyAdvisorBookCallerContextHeaders } from "@/features/advisor-book/caller-context";
import type { applyAdvisorCockpitCallerContextHeaders } from "@/features/advisor-cockpit/caller-context";
import type {
  applyIdeaRouteCallerContextHeaders,
  applyReportOrderingRouteCallerContextHeaders,
} from "./caller-context";

type Rejection = { code: string; status: number };

export function ideaAuthorityRejection(
  reason: Exclude<
    ReturnType<typeof applyIdeaRouteCallerContextHeaders>,
    { status: "not_applicable" } | { status: "applied" }
  >["reason"],
): Rejection {
  switch (reason) {
    case "authenticated_principal_required":
      return { code: "idea_authenticated_principal_required", status: 401 };
    case "unsupported_idea_route":
      return { code: "idea_route_not_supported", status: 404 };
    case "invalid_idea_request":
      return { code: "idea_request_invalid", status: 422 };
    case "development_authority_not_allowed":
    case "invalid_authority_mode":
    case "invalid_idea_configuration":
      return { code: "idea_authority_configuration_rejected", status: 500 };
  }
}

export function advisorCockpitAuthorityRejection(
  reason: Exclude<
    ReturnType<typeof applyAdvisorCockpitCallerContextHeaders>,
    { status: "not_applicable" } | { status: "applied" }
  >["reason"],
): Rejection {
  switch (reason) {
    case "authenticated_principal_required":
      return { code: "advisor_cockpit_authenticated_principal_required", status: 401 };
    case "advisor_cockpit_scope_not_entitled":
      return { code: "advisor_cockpit_scope_not_entitled", status: 403 };
    case "invalid_advisor_cockpit_request":
      return { code: "advisor_cockpit_invalid_request", status: 422 };
    case "unsupported_advisor_cockpit_route":
      return { code: "advisor_cockpit_route_not_supported", status: 404 };
    case "development_authority_not_allowed":
    case "invalid_authority_mode":
    case "invalid_advisor_cockpit_configuration":
      return { code: "advisor_cockpit_authority_configuration_rejected", status: 500 };
  }
}

export function advisorBookAuthorityRejection(
  reason: Exclude<
    ReturnType<typeof applyAdvisorBookCallerContextHeaders>,
    { status: "not_applicable" } | { status: "applied" }
  >["reason"],
): Rejection {
  switch (reason) {
    case "authenticated_principal_required":
      return { code: "advisor_book_authenticated_principal_required", status: 401 };
    case "development_authority_not_allowed":
    case "invalid_authority_mode":
    case "invalid_advisor_book_configuration":
      return { code: "advisor_book_authority_configuration_rejected", status: 500 };
  }
}

export function advisoryCopilotAuthorityRejection(
  reason: Exclude<
    Awaited<ReturnType<typeof applyAdvisoryCopilotCallerContextHeaders>>,
    { status: "not_applicable" } | { status: "applied" }
  >["reason"],
): Rejection {
  switch (reason) {
    case "authenticated_principal_required":
      return { code: "advisory_copilot_authenticated_principal_required", status: 401 };
    case "invalid_advisory_copilot_request":
      return { code: "advisory_copilot_invalid_request", status: 422 };
    case "advisory_copilot_scope_not_entitled":
      return { code: "advisory_copilot_scope_not_entitled", status: 403 };
    case "advisory_copilot_scope_not_resolved":
      return { code: "advisory_copilot_scope_not_resolved", status: 502 };
    case "development_authority_not_allowed":
    case "invalid_authority_mode":
    case "invalid_advisory_copilot_configuration":
      return { code: "advisory_copilot_authority_configuration_rejected", status: 500 };
  }
}

export function reportingAuthorityRejection(
  reason: Exclude<
    ReturnType<typeof applyReportOrderingRouteCallerContextHeaders>,
    { status: "not_applicable" } | { status: "applied" }
  >["reason"],
): Rejection {
  switch (reason) {
    case "authenticated_principal_required":
      return { code: "reporting_authenticated_principal_required", status: 401 };
    case "reporting_scope_not_entitled":
      return { code: "reporting_scope_not_entitled", status: 403 };
    case "invalid_reporting_request":
      return { code: "reporting_invalid_request", status: 422 };
    case "development_authority_not_allowed":
    case "invalid_authority_mode":
    case "invalid_reporting_configuration":
      return { code: "reporting_authority_configuration_rejected", status: 500 };
  }
}
