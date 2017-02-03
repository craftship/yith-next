/* eslint-disable no-underscore-dangle */
import Storage from '../src/adapters/s3';
import pkg from './fixtures/package';

import subject from '../src/get';

describe('GET /registry/{name}', () => {
  let event;
  let callback;
  let storageSpy;
  let storageInstance;

  beforeEach(() => {
    const env = {
      bucket: 'foo-bucket',
      region: 'bar-region',
      registry: 'https://example.com',
    };

    process.env = env;

    event = {
      pathParameters: {
        name: 'foo-bar-package',
      },
    };

    callback = stub();
  });

  context('package does not exist in private registry', () => {
    let npmPackageStub;

    beforeEach(() => {
      npmPackageStub = stub().returns(
        JSON.parse(pkg({
          major: 1,
          minor: 0,
          patch: 0,
        }).toString()));

      const mockNpm = {
        package: npmPackageStub,
      };

      storageSpy = spy(() => {
        storageInstance = createStubInstance(Storage);

        const notFoundError = new Error('No such key.');
        notFoundError.code = 'NoSuchKey';

        storageInstance.get.throws(notFoundError);

        return storageInstance;
      });

      subject.__Rewire__({
        S3: storageSpy,
        npm: mockNpm,
      });
    });

    it('should fetch package json from npm', async () => {
      await subject(event, stub(), callback);

      assert(npmPackageStub.calledWithExactly(
        'https://example.com',
        'foo-bar-package',
      ));
    });

    it('should return package json response from npm', async () => {
      await subject(event, stub(), callback);

      assert(callback.calledWithExactly(null, {
        statusCode: 200,
        body: pkg({
          major: 1,
          minor: 0,
          patch: 0,
        }).toString(),
      }));
    });

    afterEach(() => {
      subject.__ResetDependency__('npm');
      subject.__ResetDependency__('S3');
    });
  });

  context('package exists in private registry', () => {
    beforeEach(() => {
      storageSpy = spy(() => {
        storageInstance = createStubInstance(Storage);

        storageInstance.get.returns(pkg({
          major: 1,
          minor: 0,
          patch: 0,
        }));

        return storageInstance;
      });

      subject.__Rewire__('S3', storageSpy);
    });

    it('should get package json from storage with correct key', async () => {
      await subject(event, stub(), callback);

      assert(storageInstance.get.calledWithExactly(
        'foo-bar-package/index.json',
      ));
    });

    it('should return package json response', async () => {
      await subject(event, stub(), callback);

      assert(callback.calledWithExactly(null, {
        statusCode: 200,
        body: pkg({
          major: 1,
          minor: 0,
          patch: 0,
        }).toString(),
      }));
    });

    afterEach(() => {
      subject.__ResetDependency__('S3');
    });
  });

  context('npm errors', () => {
    beforeEach(() => {
      storageSpy = spy(() => {
        storageInstance = createStubInstance(Storage);

        storageInstance.get.throws(new Error('Storage error.'));

        return storageInstance;
      });

      subject.__Rewire__('S3', storageSpy);
    });

    it('should return correct status code and response with error', async () => {
      await subject(event, stub(), callback);

      assert(callback.calledWithExactly(null, {
        statusCode: 500,
        body: '{"error":"Storage error."}',
      }));
    });

    afterEach(() => {
      subject.__ResetDependency__('S3');
    });
  });

  context('storage get errors', () => {
    let npmPackageStub;

    beforeEach(() => {
      const npmError = new Error('Npm error.');
      npmError.status = 500;

      npmPackageStub = stub().throws(npmError);

      const mockNpm = {
        package: npmPackageStub,
      };

      storageSpy = spy(() => {
        storageInstance = createStubInstance(Storage);

        const notFoundError = new Error('No such key.');
        notFoundError.code = 'NoSuchKey';

        storageInstance.get.throws(notFoundError);

        return storageInstance;
      });

      subject.__Rewire__({
        S3: storageSpy,
        npm: mockNpm,
      });
    });

    it('should return 500 response with error', async () => {
      await subject(event, stub(), callback);

      assert(callback.calledWithExactly(null, {
        statusCode: 500,
        body: '{"error":"Npm error."}',
      }));
    });

    afterEach(() => {
      subject.__ResetDependency__('npm');
      subject.__ResetDependency__('S3');
    });
  });
});