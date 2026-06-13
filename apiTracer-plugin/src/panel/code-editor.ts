/**
 * 轻量代码编辑器：textarea 之上叠加高亮 <pre>，零依赖。
 */

import { highlightJs } from "./highlight";

export class CodeEditor {
  readonly textarea: HTMLTextAreaElement;
  private readonly highlight: HTMLPreElement;

  constructor(host: HTMLElement) {
    host.classList.add("code-editor");

    this.highlight = document.createElement("pre");
    this.highlight.className = "code-highlight";
    this.highlight.setAttribute("aria-hidden", "true");

    this.textarea = document.createElement("textarea");
    this.textarea.className = "code-input";
    this.textarea.spellcheck = false;
    this.textarea.autocapitalize = "off";
    this.textarea.setAttribute("autocorrect", "off");

    host.appendChild(this.highlight);
    host.appendChild(this.textarea);

    this.textarea.addEventListener("input", () => this.update());
    this.textarea.addEventListener("scroll", () => {
      this.highlight.scrollTop = this.textarea.scrollTop;
      this.highlight.scrollLeft = this.textarea.scrollLeft;
    });
    // Tab 输入两空格
    this.textarea.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const { selectionStart: a, selectionEnd: b, value } = this.textarea;
        this.textarea.value = value.slice(0, a) + "  " + value.slice(b);
        this.textarea.selectionStart = this.textarea.selectionEnd = a + 2;
        this.update();
      }
    });

    this.update();
  }

  get value(): string {
    return this.textarea.value;
  }
  set value(v: string) {
    this.textarea.value = v;
    this.update();
  }

  setPlaceholder(text: string): void {
    this.textarea.placeholder = text;
  }

  focus(): void {
    this.textarea.focus();
  }

  private update(): void {
    // 末尾加换行避免最后一行被裁
    this.highlight.innerHTML = highlightJs(this.textarea.value) + "\n";
  }
}
