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

/** Frame 60 left half: blobs, booti field, product mark, story card and the pitch. Wrap in .theme-peacock. */
export function SignInArt() {
  return (
    <section className="relative isolate flex flex-col overflow-hidden px-6 pt-8 pb-10 sm:px-10 lg:min-h-screen lg:px-[72px] lg:pt-10 lg:pb-[72px]">
      <EntryBackdrop variant="sign-in" />
      <ProductMark />
      <div className="mt-[132px] hidden justify-end lg:flex lg:pr-[30px]">
        <StoryCard />
      </div>
      <div className="mt-10 flex flex-col gap-5 lg:mt-auto lg:pt-16">
        <h1 className="max-w-[500px] font-display text-[40px] leading-[1.05] font-bold tracking-[-0.9px] text-ink-900 sm:text-[52px] xl:text-[64px] xl:tracking-[-1.4px]">
          See the sales AI shoppers take from you.
        </h1>
        <p className="max-w-[480px] text-[17px] leading-[1.6] text-ink-700">
          We ask ChatGPT, Claude and Gemini what your customers ask, and show you who they pick.
        </p>
        <AssistantStack />
      </div>
    </section>
  );
}
