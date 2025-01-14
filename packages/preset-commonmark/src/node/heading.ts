/* Copyright 2021, Milkdown by Mirone. */
import { commandsCtx, editorViewCtx } from '@milkdown/core'
import { expectDomTypeError } from '@milkdown/exception'
import { setBlockType } from '@milkdown/prose/commands'
import { textblockTypeInputRule } from '@milkdown/prose/inputrules'
import type { Node } from '@milkdown/prose/model'
import { Fragment } from '@milkdown/prose/model'
import { $command, $ctx, $inputRule, $nodeAttr, $nodeSchema, $useKeymap } from '@milkdown/utils'
import { paragraphSchema } from './paragraph'

const headingIndex = Array(6)
  .fill(0)
  .map((_, i) => i + 1)

const defaultHeadingIdGenerator = (node: Node) =>
  node.textContent
    .replace(/[\p{P}\p{S}]/gu, '')
    .replace(/\s/g, '-')
    .toLowerCase()
    .trim()

/// This is a slice contains a function to generate heading id.
/// You can configure it to generate id in your own way.
export const headingIdGenerator = $ctx(defaultHeadingIdGenerator, 'headingIdGenerator')

/// HTML attributes for heading node.
export const headingAttr = $nodeAttr('heading')

/// Schema for heading node.
export const headingSchema = $nodeSchema('heading', (ctx) => {
  const getId = ctx.get(headingIdGenerator.key)
  return {
    content: 'inline*',
    group: 'block',
    defining: true,
    attrs: {
      id: {
        default: '',
      },
      level: {
        default: 1,
      },
    },
    parseDOM: headingIndex.map(x => ({
      tag: `h${x}`,
      getAttrs: (node) => {
        if (!(node instanceof HTMLElement))
          throw expectDomTypeError(node)

        return { level: x, id: node.id }
      },
    })),
    toDOM: (node) => {
      return [
        `h${node.attrs.level}`,
        {
          ...ctx.get(headingAttr.key)(node),
          id: node.attrs.id || getId(node),
        },
        0,
      ]
    },
    parseMarkdown: {
      match: ({ type }) => type === 'heading',
      runner: (state, node, type) => {
        const depth = node.depth as number
        state.openNode(type, { level: depth })
        state.next(node.children)
        state.closeNode()
      },
    },
    toMarkdown: {
      match: node => node.type.name === 'heading',
      runner: (state, node) => {
        state.openNode('heading', undefined, { depth: node.attrs.level })
        const lastIsHardbreak = node.childCount >= 1 && node.lastChild?.type.name === 'hardbreak'
        if (lastIsHardbreak) {
          const contentArr: Node[] = []
          node.content.forEach((n, _, i) => {
            if (i === node.childCount - 1)
              return

            contentArr.push(n)
          })
          state.next(Fragment.fromArray(contentArr))
        }
        else {
          state.next(node.content)
        }
        state.closeNode()
      },
    },
  }
})

/// This input rule can turn the selected block into heading.
/// You can input numbers of `#` and a `space` to create heading.
export const wrapInHeadingInputRule = $inputRule((ctx) => {
  return textblockTypeInputRule(/^(?<hashes>#+)\s$/, headingSchema.type(), (match) => {
    const x = match.groups?.hashes?.length || 0

    const view = ctx.get(editorViewCtx)
    const { $from } = view.state.selection
    const node = $from.node()
    if (node.type.name === 'heading') {
      let level = Number(node.attrs.level) + Number(x)
      if (level > 6)
        level = 6

      return { level }
    }
    return { level: x }
  })
})

/// This command can turn the selected block into heading.
/// You can pass the level of heading to this command.
/// By default, the level is 1, which means it will create a `h1` element.
export const wrapInHeadingCommand = $command('WrapInHeading', () => {
  return (level?: number) => {
    level ??= 1

    if (level < 1)
      return setBlockType(paragraphSchema.type())

    return setBlockType(headingSchema.type(), { level })
  }
})

/// This command can downgrade the selected heading.
/// For example, if you have a `h2` element, and you call this command, you will get a `h1` element.
/// If the element is already a `h1` element, it will turn it into a `p` element.
export const downgradeHeadingCommand = $command('DowngradeHeading', () => () =>
  (state, dispatch, view) => {
    const { $from } = state.selection
    const node = $from.node()
    if (node.type !== headingSchema.type() || !state.selection.empty || $from.parentOffset !== 0)
      return false

    const level = node.attrs.level - 1
    if (!level)
      return setBlockType(paragraphSchema.type())(state, dispatch, view)

    dispatch?.(
      state.tr.setNodeMarkup(state.selection.$from.before(), undefined, {
        ...node.attrs,
        level,
      }),
    )
    return true
  })

/// Keymap for heading node.
/// - `<Mod-Alt-{1-6}>`: Turn the selected block into `h{1-6}` element.
/// - `<Delete>/<Backspace>`: Downgrade the selected heading.
export const headingKeymap = $useKeymap('headingKeymap', {
  TurnIntoH1: {
    shortcuts: 'Mod-Alt-1',
    command: (ctx) => {
      const commands = ctx.get(commandsCtx)
      return () => commands.call(wrapInHeadingCommand.key, 1)
    },
  },
  TurnIntoH2: {
    shortcuts: 'Mod-Alt-2',
    command: (ctx) => {
      const commands = ctx.get(commandsCtx)
      return () => commands.call(wrapInHeadingCommand.key, 2)
    },
  },
  TurnIntoH3: {
    shortcuts: 'Mod-Alt-3',
    command: (ctx) => {
      const commands = ctx.get(commandsCtx)
      return () => commands.call(wrapInHeadingCommand.key, 3)
    },
  },
  TurnIntoH4: {
    shortcuts: 'Mod-Alt-4',
    command: (ctx) => {
      const commands = ctx.get(commandsCtx)
      return () => commands.call(wrapInHeadingCommand.key, 3)
    },
  },
  TurnIntoH5: {
    shortcuts: 'Mod-Alt-5',
    command: (ctx) => {
      const commands = ctx.get(commandsCtx)
      return () => commands.call(wrapInHeadingCommand.key, 3)
    },
  },
  TurnIntoH6: {
    shortcuts: 'Mod-Alt-6',
    command: (ctx) => {
      const commands = ctx.get(commandsCtx)
      return () => commands.call(wrapInHeadingCommand.key, 3)
    },
  },
  DowngradeHeading: {
    shortcuts: ['Delete', 'Backspace'],
    command: (ctx) => {
      const commands = ctx.get(commandsCtx)
      return () => commands.call(downgradeHeadingCommand.key)
    },
  },
})
