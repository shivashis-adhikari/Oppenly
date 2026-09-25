import { card, toast } from '../store';
import { Card } from './Card';
import { FieldButton } from './FieldButton';
import { RewritePopover, SelectionBar } from './Rewrite';
import { Sidebar } from './Sidebar';
import { Underlines } from './Underlines';

export function App() {
  return (
    <div class="op-app">
      <Underlines />
      <FieldButton />
      <SelectionBar />
      <RewritePopover />
      {card.value && <Card key={card.value.suggestion} />}
      <Sidebar />
      {toast.value && (
        <div class="op-toast" role="status">
          {toast.value.text}
          {toast.value.action && (
            <button
              type="button"
              onClick={() => {
                toast.value?.action?.run();
                toast.value = null;
              }}
            >
              {toast.value.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
