// Reusable state components (Pencil frame 70 "States"). Import from '@/components/screens/states'.
// Everything is server-safe except HealthBanner (client, self-wired to GET /api/health).

export { describeError, type ErrorInfo, type ErrorKind } from './errors';
export {
  WorkerOfflineBanner,
  RunInProgressBanner,
  PartialRunBanner,
  RunStateBanner,
  SignInError,
  type WorkerOfflineBannerProps,
  type RunBannerProps,
} from './banners';
export { HealthBanner, type HealthBannerProps } from './health-banner';
export {
  InlineError,
  FilterEmpty,
  NullValue,
  FieldError,
  NoRunsYet,
  type InlineErrorProps,
  type FilterEmptyProps,
  type NullValueProps,
  type NoRunsYetProps,
} from './inline';
export { PageState, NotFoundState, SignedOutState, type PageStateProps, type PageStateTone } from './page-state';
