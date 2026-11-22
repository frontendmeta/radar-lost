import { AssistantLogo, OutcomePill } from '@/components/ui';
import { EntryBackdrop } from './backdrop';
import { AssistantStack, ProductMark } from './marks';

/** Frame 60 "Story card": a tiny ChatGPT shopping moment that ends in a lost sale. */
function StoryCard() {
  return (
    <figure
      aria-label="Example: ChatGPT is asked for a cotton kurta set and picks a rival brand"
      className="flex w-full max-w-[400px] animate-pop-in flex-col gap-3.5 rounded-[24px] bg-surface p-5 shadow-raised"
    >
      <figcaption className="flex items-center gap-2">
        <span className="inline-flex size-7 items-center justify-center rounded-pill border border-ink-200 bg-surface">
          <AssistantLogo assistant="openai" size={16} decorative />
        </span>
        <span className="text-[13px] leading-4 font-semibold text-ink-700">ChatGPT is shopping</span>
      </figcaption>
      <p className="rounded-[20px_20px_20px_6px] bg-brand-50 px-4 py-3 text-[15px] leading-[1.5] text-ink-900">
        Cotton kurta set under ₹1,500, delivered in Mumbai tomorrow.
      </p>
      <div className="flex items-center gap-2">
        <OutcomePill outcome="mentioned_lost" label="You: named, lost" />
        <span className="text-[13px] leading-4 font-semibold text-ink-500">It picked a rival</span>
      </div>
    </figure>
  );
}

const HOW_IT_WORKS = [
  { title: 'We play your shopper.', body: 'Real customer questions go to ChatGPT, Claude and Gemini.' },
  { title: 'We record every decision.', body: 'What each AI searched, read and picked.' },
  { title: 'You see why you lost.', body: 'Who beat you, why, and 3 fixes to win it back.' },
];

/**
 * Frame 60 left half. On desktop it is exactly one viewport tall (no scroll): the story card only
 * shows when there is height for it, and type scales with the viewport height.
 */
export function SignInArt() {
  return (
    <section className="relative isolate flex flex-col overflow-hidden px-6 pt-6 pb-6 sm:px-10 lg:h-dvh lg:px-[64px] lg:pt-8 lg:pb-10">
      <EntryBackdrop variant="sign-in" />
      <ProductMark />
      <div className="hidden min-h-0 flex-1 items-center justify-end lg:pr-[30px] [@media(min-height:860px)]:lg:flex">
        <StoryCard />
      </div>
      <div className="mt-6 flex flex-col gap-[clamp(12px,2vh,20px)] lg:mt-auto">
        <h1 className="max-w-[520px] font-display text-[34px] leading-[1.05] font-bold tracking-[-0.8px] text-ink-900 lg:text-[clamp(34px,5.6vh,56px)]">
          See the sales AI shoppers take from you.
        </h1>
        <p className="max-w-[500px] text-[16px] leading-[1.5] text-ink-700">
          Shoppers now ask AI to find and buy for them. The brand that loses never finds out.
        </p>
        <ol className="hidden max-w-[520px] flex-col gap-2 sm:flex" aria-label="How Lost Sale Radar works">
          {HOW_IT_WORKS.map((step, i) => (
            <li key={step.title} className="flex items-center gap-3">
              <span
                aria-hidden
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-pill bg-surface text-[12px] font-bold text-ink-900 shadow-card"
              >
                {i + 1}
              </span>
              <p className="text-[14px] leading-[1.4] text-ink-700">
                <span className="font-semibold text-ink-900">{step.title}</span> {step.body}
              </p>
            </li>
          ))}
        </ol>
        <AssistantStack />
      </div>
    </section>
  );
}
