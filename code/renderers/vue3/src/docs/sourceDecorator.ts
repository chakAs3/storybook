/* eslint-disable no-underscore-dangle */
import { addons, useEffect } from '@storybook/preview-api';
import type { ArgTypes, Args, StoryContext, Renderer } from '@storybook/types';

import { SourceType, SNIPPET_RENDERED } from '@storybook/docs-tools';

import { format } from 'prettier';
import parserTypescript from 'prettier/parser-typescript.js';
import parserHTML from 'prettier/parser-html.js';
// eslint-disable-next-line import/no-extraneous-dependencies
import { isArray } from '@vue/shared';

/**
 * Check if the sourcecode should be generated.
 *
 * @param context StoryContext
 */
const skipSourceRender = (context: StoryContext<Renderer>) => {
  const sourceParams = context?.parameters.docs?.source;
  const isArgsStory = context?.parameters.__isArgsStory;

  // always render if the user forces it
  if (sourceParams?.type === SourceType.DYNAMIC) {
    return false;
  }

  // never render if the user is forcing the block to render code, or
  // if the user provides code, or if it's not an args story.
  return !isArgsStory || sourceParams?.code || sourceParams?.type === SourceType.CODE;
};

/**
 * Extract a component name.
 *
 * @param component Component
 */
function getComponentName(component: any): string | null {
  return component?.name || component?.__name || component?.__docgenInfo?.__name || null;
}
/**
 * Transform args to props string
 * @param args
 * @param argTypes
 * @param slotProp prop used to simulate slot
 */
function argsToSource(args: any, argTypes: ArgTypes, slotProps?: string[] | null): string {
  const argsKeys = Object.keys(args);
  const source = argsKeys
    .map((key) => propToDynamicSource(key, args[key], argTypes, slotProps))
    .filter((item) => item !== '')
    .join(' ');

  return source;
}

function propToDynamicSource(
  key: string,
  val: string | boolean | object,
  argTypes: ArgTypes,
  slotProps?: string[] | null
): string {
  // slot Args or default value
  if (
    (slotProps && slotProps.indexOf(key) > -1) ||
    (argTypes[key] && argTypes[key].defaultValue === val)
  )
    return '';
  return `${key === val ? ':' : ''}${key}=${JSON.stringify(val)}`;
}

function generateSetupScript(args: any, argTypes: ArgTypes): string {
  const argsKeys = args ? Object.keys(args) : [];
  let scriptBody = '';
  // eslint-disable-next-line no-restricted-syntax
  for (const key of argsKeys) {
    if (!(argTypes[key] && argTypes[key].defaultValue === args[key]))
      if (typeof args[key] !== 'function')
        scriptBody += `\n const ${key} = ref(${JSON.stringify(args[key])})`;
      else scriptBody += `\n const ${key} = ()=>{${args[key].toString()}}`;
  }
  return `<script lang="ts" setup>${scriptBody}\n</script>`;
}

function getTemplates(renderFunc: any): [] {
  const ast = parserHTML.parsers.vue.parse(
    renderFunc.toString(),
    { vue: parserHTML.parsers.vue },
    {
      locStart(node: any): number {
        throw new Error('Function not implemented.');
      },
      locEnd(node: any): number {
        throw new Error('Function not implemented.');
      },
      originalText: '',
      semi: false,
      singleQuote: false,
      jsxSingleQuote: false,
      trailingComma: 'none',
      bracketSpacing: false,
      bracketSameLine: false,
      jsxBracketSameLine: false,
      rangeStart: 0,
      rangeEnd: 0,
      parser: 'vue',
      filepath: '',
      requirePragma: false,
      insertPragma: false,
      proseWrap: 'always',
      arrowParens: 'always',
      plugins: [],
      pluginSearchDirs: false,
      htmlWhitespaceSensitivity: 'css',
      endOfLine: 'auto',
      quoteProps: 'preserve',
      vueIndentScriptAndStyle: false,
      embeddedLanguageFormatting: 'auto',
      singleAttributePerLine: false,
      printWidth: 0,
      tabWidth: 0,
      useTabs: false,
    }
  );

  let components = ast.children?.filter((element: any) => element.name);
  components = components.map((element: any) => {
    const { attrs: att = [] } = element;
    const att3 = att?.filter((el: any) => el.name !== 'v-bind'); //  as Array<any>).push(props);
    return { name: element.name, attrs: att3 };
  });
  return components;
}

/**
 * Generate a vue3 template.
 *
 * @param component Component
 * @param args Args
 * @param argTypes ArgTypes
 * @param slotProp Prop used to simulate a slot
 */
export function generateSource(
  compOrComps: any,
  args: Args,
  argTypes: ArgTypes,
  slotProps?: string[] | null
): string | null {
  if (!compOrComps) return null;
  const generateComponentSource = (component: any): string | null => {
    const name = getComponentName(component);

    if (!name) {
      return '';
    }

    const props = argsToSource(args, argTypes, slotProps);
    const slotValues = slotProps?.map((slotProp) => args[slotProp]);

    if (slotValues) {
      const namedSlotContents = createNamedSlots(slotProps, slotValues);
      return `<${name} ${props}>\n${namedSlotContents}\n</${name}>`;
    }

    return `<${name} ${props}/>`;
  };
  // handle one component or multiple
  const components = isArray(compOrComps) ? compOrComps : [compOrComps];
  let source = '';
  // eslint-disable-next-line no-restricted-syntax
  for (const comp of components) {
    source += `${generateComponentSource(comp)}`;
  }

  return source;
}
/**
 * create Named Slots content in source
 * @param slotProps
 * @param slotValues
 */

function createNamedSlots(
  slotProps: string[] | null | undefined,
  slotValues: { [key: string]: any }
) {
  if (!slotProps) return '';
  if (slotProps.length === 1) return `{{ ${slotProps[0]} }}`;

  return slotProps
    .filter((slotProp) => slotValues[slotProps.indexOf(slotProp)])
    .map((slotProp) => `  <template #${slotProp}> {{ ${slotProp} }} </template>`)
    .join('\n');
}
/**
 * format prettier for vue
 * @param source
 */

function prettierFormat(source: string): string {
  return format(source, {
    vueIndentScriptAndStyle: true,
    parser: 'vue',
    plugins: [parserHTML, parserTypescript],
  });
}
/**
 * get slots from vue component
 * @param ctxtComponent Vue Component
 */

function getComponentSlots(ctxtComponent: any): string[] {
  if (!ctxtComponent) return [];
  return ctxtComponent?.__docgenInfo?.slots?.map((slot: { name: string }) => slot.name) || [];
}

/**
 *  source decorator.
 * @param storyFn Fn
 * @param context  StoryContext
 */
export const sourceDecorator = (storyFn: any, context: StoryContext<Renderer>) => {
  const channel = addons.getChannel();
  const skip = skipSourceRender(context);
  const story = storyFn();

  let source: string;

  useEffect(() => {
    if (!skip && source) {
      channel.emit(SNIPPET_RENDERED, (context || {}).id, source);
    }
  });

  if (skip) {
    return story;
  }

  const {
    parameters = {},
    args = {},
    component: ctxtComponent,
    originalStoryFn: render,
  } = context || {};
  const components = getTemplates(render);
  console.log('params :', parameters, args, ctxtComponent, render, components);
  const renderedComponent = components.length ? components : ctxtComponent;

  const slotProps: string[] = getComponentSlots(ctxtComponent);

  const withScriptSetup = parameters?.docs?.source?.scriptSetup;
  const generatedScript = withScriptSetup ? generateSetupScript(args, context?.argTypes) : '';
  const generatedTemplate = generateSource(
    renderedComponent,
    withScriptSetup ? args.map((key: any) => key) : args,
    context?.argTypes,
    slotProps
  );

  if (generatedTemplate) {
    source = prettierFormat(`${generatedScript}\n <template>\n ${generatedTemplate} \n</template>`);
  }

  return story;
};
