export default function ComposePage() {
  return (
    <main>
      <label>
        Title
        <input type="text" name="title" />
      </label>

      <div data-testid="editor-body" role="textbox" aria-label="Body editor" contentEditable />

      <label>
        Font size
        <select name="fontSize" defaultValue="16">
          {[14, 16, 18, 20, 22, 24].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <label>
        Left padding
        <input type="number" name="leftPadding" defaultValue={0} min={0} max={64} />
      </label>

      <div>
        <span data-testid="tag-suggestion-chip">example-tag</span>
      </div>

      <input placeholder="Add custom tag" />

      <button type="button">Publish</button>

      <div role="status" aria-label="draft-saved" />
    </main>
  );
}
