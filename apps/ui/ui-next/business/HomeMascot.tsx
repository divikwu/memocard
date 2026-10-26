import { Mascot } from 'page-mascot';
import directions from '../../src/assets/mascots/memocard-final-black-pen-directions.webp';
import reactions from '../../src/assets/mascots/memocard-final-black-pen-reactions.webp';

export function HomeMascot() {
  return <Mascot directions={directions} reactions={reactions} size={144} label="MemoCard · 黑笔最终版" className="rounded-lg outline-none focus-visible:focus-ring" />;
}
