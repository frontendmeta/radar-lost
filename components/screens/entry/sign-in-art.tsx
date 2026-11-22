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
  {
    title: 'We play your shopper.',
    body: 'Real questions your customers ask, with a budget, a size, a city and a deadline, go to ChatGPT, Claude and Gemini with web search on.',
  },
  {
    title: 'We record every decision.',
    body: 'What each AI searched, which sites it read, what it shortlisted and which brand it finally picked.',
  },
  {
    title: 'You see why you lost.',
    body: 'How often you were found, mentioned and picked, who beat you, the reason behind each lost sale, and three fixes to win it back.',
  },
];

/** Frame 60 left half: blobs, booti field, product mark, story card and the pitch. Wrap in .theme-peacock. */
export function SignInArt() {
  return (
    <section className="relative isolate flex flex-col overflow-hidden px-6 pt-8 pb-10 sm:px-10 lg:min-h-screen lg:px-[72px] lg:pt-10 lg:pb-[72px]">
      <EntryBackdrop variant="sign-in" />
      <ProductMark />
      <div className="mt-14 hidden justify-end lg:flex lg:pr-[30px]">
        <StoryCard />
      </div>
      <div className="mt-10 flex flex-col gap-5 lg:mt-auto lg:pt-12">
        <h1 className="max-w-[520px] font-display text-[40px] leading-[1.05] font-bold tracking-[-0.9px] text-ink-900 sm:text-[48px] xl:text-[56px] xl:tracking-[-1.2px]">
          See the sales AI shoppers take from you.
        </h1>
        <p className="max-w-[520px] text-[17px] leading-[1.6] text-ink-700">
          Shoppers now ask ChatGPT, Claude or Gemini to find the best product and buy it. The AI compares,
          picks and orders, and the brand that loses never finds out, because analytics tools count these
          visits as bot traffic.
        </p>
        <ol className="flex max-w-[520px] flex-col gap-3.5" aria-label="How Lost Sale Radar works">
          {HOW_IT_WORKS.map((step, i) => (
            <li key={step.title} className="flex gap-3.5">
              <span
                aria-hidden
                className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-pill bg-surface text-[13px] font-bold text-ink-900 shadow-card"
              >
                {i + 1}
              </span>
              <p className="text-[15px] leading-[1.55] text-ink-700">
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
