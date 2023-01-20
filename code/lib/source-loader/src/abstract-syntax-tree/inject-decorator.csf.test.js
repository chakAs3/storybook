import { readFile } from 'fs/promises';
import path from 'path';
import 'jest-specific-snapshot';
import injectDecorator from './inject-decorator';

const regex = /\r\n|\r|\n/g;

describe('inject-decorator', () => {
  const snapshotDir = path.join(__dirname, '__snapshots__');

  describe('positive - ts - csf', () => {
    it('includes storySource parameter in the default exported object', async () => {
      const mockFilePath = './__mocks__/inject-decorator.ts.csf.txt';
      const source = await readFile(mockFilePath, 'utf-8');
      const result = injectDecorator(source, path.resolve(__dirname, mockFilePath), {
        parser: 'typescript',
      });

      expect(result.source.replace(regex, '\n')).toMatchSpecificSnapshot(
        path.join(snapshotDir, `inject-decorator.csf.test.js.snapshot`)
      );
      expect(result.source).toEqual(expect.stringContaining('"source": "import React from'));
    });

    it('includes storySource parameter in the default exported variable', async () => {
      const mockFilePath = './__mocks__/inject-decorator.ts.csf-meta-var.txt';
      const source = await readFile(mockFilePath, 'utf-8');
      const result = injectDecorator(source, path.resolve(__dirname, mockFilePath), {
        parser: 'typescript',
      });

      expect(result.source.replace(regex, '\n')).toMatchSpecificSnapshot(
        path.join(snapshotDir, `inject-decorator.csf-meta-var.test.js.snapshot`)
      );
      expect(result.source).toEqual(expect.stringContaining('"source": "import React from'));
    });
  });

  describe('injectStoryParameters - ts - csf', () => {
    it('includes storySource parameter in the default exported object', async () => {
      const mockFilePath = './__mocks__/inject-parameters.ts.csf.txt';
      const source = await readFile(mockFilePath, 'utf-8');
      const result = injectDecorator(source, path.resolve(__dirname, mockFilePath), {
        injectStoryParameters: true,
        parser: 'typescript',
      });
      expect(result.source.replace(regex, '\n')).toMatchSpecificSnapshot(
        path.join(snapshotDir, `inject-decorator.csf.test.js.injectStoryParameters.snapshot`)
      );
    });
  });
});
