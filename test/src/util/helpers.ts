import {customElement, html, LitElement, property} from 'lit-element';
import {render, TemplateResult} from 'lit-html';

interface HasKeyCode {
  keyCode: number;
}

declare global {
  interface Window {
    tachometerResult: undefined|number;
  }
}

@customElement('test-fixture')
export class TestFixture extends LitElement {
  @property({type: Boolean}) shouldAttachContents = true;

  @property({type: Object}) template: TemplateResult = html``;

  remove(): boolean {
    const parent = this.parentNode;
    if (parent) {
      parent.removeChild(this);
      return true;
    }

    return false;
  }

  get root(): ShadowRoot {
    return this.shadowRoot as ShadowRoot;
  }

  attachContents(options = {awaitRender: false}) {
    this.shouldAttachContents = true;

    if (options.awaitRender) {
      const rendered = new Promise((res) => {
        requestAnimationFrame(res);
      });

      return rendered;
    } else {
      return this.updateComplete;
    }
  }

  detachContents(options = {awaitRender: false}) {
    this.shouldAttachContents = false;

    if (options.awaitRender) {
      const rendered = new Promise((res) => {
        requestAnimationFrame(res);
      });

      return rendered;
    } else {
      return this.updateComplete;
    }
  }

  protected render() {
    return html`
      ${this.shouldAttachContents ? this.template : ''}
    `;
  }
}

const defaultOpts = {
  shouldAttachContents: true,
  document: document,
  afterRender: null,
};

interface FixtureOptions {
  shouldAttachContents: boolean;
  document: Document;
  afterRender: ((root: ShadowRoot) => Promise<void>)|null;
}

export const fixture =
    async (template: TemplateResult, options?: Partial<FixtureOptions>) => {
  const opts: FixtureOptions = {...defaultOpts, ...options};
  const tf = opts.document.createElement('test-fixture') as TestFixture;
  tf.shouldAttachContents = opts.shouldAttachContents;
  tf.template = template;


  opts.document.body.appendChild(tf);
  if (opts.shouldAttachContents) {
    await tf.updateComplete;
  }

  if (opts.afterRender) {
    await opts.afterRender(tf.root);
  }

  return tf;
};

interface MeasureFixtureCreationOpts {
  afterRender?: (root: ShadowRoot) => Promise<unknown>;
  numRenders: number;
  renderCheck?: (root: ShadowRoot) => Promise<unknown>;
}

const defaultMeasureOpts = {
  numRenders: 10,
};

export const measureFixtureCreation = async (
    template: TemplateResult,
    options?: Partial<MeasureFixtureCreationOpts>) => {
  const opts: MeasureFixtureCreationOpts = {...defaultMeasureOpts, ...options};
  const templates = new Array<TemplateResult>(opts.numRenders).fill(template);
  const renderContainer = document.createElement('div');
  const renderTargetRoot = renderContainer.attachShadow({mode: 'open'});

  document.body.appendChild(renderContainer);

  await new Promise(async (res) => {
    performance.mark('measureFixture-start');
    render(templates, renderTargetRoot);
    const firstChild = renderTargetRoot.firstElementChild;
    const lastChild = renderTargetRoot.lastElementChild;

    if (opts.renderCheck) {
      await opts.renderCheck(renderTargetRoot);
    } else if (lastChild && 'updateComplete' in lastChild) {
      await (lastChild as LitElement).updateComplete;
      document.body.offsetWidth;
    } else if (firstChild && 'updateComplete' in firstChild) {
      await (firstChild as LitElement).updateComplete;
      document.body.offsetWidth;
    } else {
      await new Promise((res) => requestAnimationFrame(res));
      document.body.offsetWidth;
    }


    if (opts.afterRender) {
      await opts.afterRender(renderTargetRoot);
    }

    res();
  })
      .then(
          // this adds an extra microtask and awaits any trailing async updates
          async () => undefined);

  performance.mark('measureFixture-end');
  performance.measure(
      'fixture-creation', 'measureFixture-start', 'measureFixture-end');

  const duration = performance.getEntriesByName('fixture-creation')[0].duration;
  window.tachometerResult = duration;

  return renderTargetRoot;
};

export const rafPromise = async () => new Promise((res) => {
  requestAnimationFrame(res);
});

export class Fake<TArgs extends any[], TReturn> {
  public calls: Array<{args: TArgs}> = [];
  public get called(): boolean {
    return this.calls.length > 0;
  }
  public get callCount(): number {
    return this.calls.length;
  }
  public returnValue?: TReturn;
  public handler: (...args: TArgs) => TReturn;

  public constructor() {
    this.handler = (...args: TArgs) => {
      this.calls.push({args});
      return this.returnValue as TReturn;
    };
  }
}

export const waitForEvent = (el: Element, ev: string) => new Promise((res) => {
  el.addEventListener(ev, () => {
    res();
  }, {once: true});
});

export const ieSafeKeyboardEvent = (type: string, keycode: number) => {
  // IE es5 fix
  const init = {detail: 0, bubbles: true, cancelable: true, composed: true};
  const ev = new CustomEvent(type, init);

  // esc key
  (ev as unknown as HasKeyCode).keyCode = keycode;

  return ev;
}