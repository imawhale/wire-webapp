/*
 * Wire
 * Copyright (C) 2018 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 *
 */

import {User} from 'src/script/entity/User';
import {Environment} from 'src/script/util/Environment';

import {ClientRepository} from 'src/script/client/ClientRepository';
import {ClientType} from 'src/script/client/ClientType';
import {ClientEntity} from 'src/script/client/ClientEntity';

describe('ClientRepository', () => {
  const testFactory = new TestFactory();
  const clientId = '5021d77752286cac';
  let userId = undefined;

  beforeAll(() => {
    return testFactory.exposeClientActors().then(() => {
      userId = TestFactory.client_repository.selfUser().id;
    });
  });

  beforeEach(() => TestFactory.storage_repository.clearStores());

  describe('getClientsByUserId', () =>
    it('maps client entities from client payloads by the backend', () => {
      const client = new ClientEntity();
      client.id = clientId;

      TestFactory.client_repository.currentClient(client);

      const allClients = [
        {class: 'desktop', id: '706f64373b1bcf79'},
        {class: 'phone', id: '809fd276d6709474'},
        {class: 'desktop', id: '8e11e06549c8cf1a'},
        {class: 'tablet', id: 'c411f97b139c818b'},
        {class: 'desktop', id: 'cbf3ea49214702d8'},
      ];
      spyOn(TestFactory.client_repository.clientService, 'getClientsByUserId').and.returnValue(
        Promise.resolve(allClients),
      );

      return TestFactory.client_repository.getClientsByUserId(entities.user.john_doe.id).then(clientEntities => {
        expect(clientEntities.length).toBe(allClients.length);
      });
    }));

  describe('getValidLocalClient', () => {
    const clientPayloadServer = {
      address: '62.96.148.44',
      class: 'desktop',
      id: clientId,
      label: 'Windows 10',
      location: {
        lat: 52.5233,
        lon: 13.4138,
      },
      model: 'Wire for Windows',
      time: '2016-05-02T11:53:49.976Z',
      type: 'permanent',
    };

    const clientPayloadDatabase = {
      ...clientPayloadServer,
      meta: {
        is_verified: true,
        primary_key: 'local_identity',
      },
    };

    it('resolves with a valid client', () => {
      const clientService = TestFactory.client_repository.clientService;
      const backendClient = clientService.backendClient;

      spyOn(clientService, 'loadClientFromDb').and.returnValue(Promise.resolve(clientPayloadDatabase));
      spyOn(backendClient, 'sendRequest').and.returnValue(Promise.resolve(clientPayloadServer));

      return TestFactory.client_repository.getValidLocalClient().then(clientObservable => {
        expect(clientObservable).toBeDefined();
        expect(clientObservable().id).toBe(clientId);
      });
    });

    it('rejects with an error if no client found locally', () => {
      const clientService = TestFactory.client_repository.clientService;
      const backendClient = clientService.backendClient;
      spyOn(clientService, 'loadClientFromDb').and.returnValue(
        Promise.resolve(ClientRepository.PRIMARY_KEY_CURRENT_CLIENT),
      );
      const backendError = new Error();
      backendError.code = 404;
      spyOn(backendClient, 'sendRequest').and.returnValue(Promise.reject(backendError));

      return TestFactory.client_repository
        .getValidLocalClient()
        .then(fail)
        .catch(error => {
          expect(error).toEqual(jasmine.any(z.error.ClientError));
          expect(error.type).toBe(z.error.ClientError.TYPE.NO_VALID_CLIENT);
        });
    });

    it('rejects with an error if client removed on backend', () => {
      const clientService = TestFactory.client_repository.clientService;
      const backendClient = clientService.backendClient;
      spyOn(clientService, 'loadClientFromDb').and.returnValue(Promise.resolve(clientPayloadDatabase));
      spyOn(TestFactory.storage_service, 'deleteDatabase').and.returnValue(Promise.resolve(true));
      const backendError = new Error();
      backendError.code = 404;
      spyOn(backendClient, 'sendRequest').and.returnValue(Promise.reject(backendError));

      return TestFactory.client_repository
        .getValidLocalClient()
        .then(fail)
        .catch(error => {
          expect(error).toEqual(jasmine.any(z.error.ClientError));
          expect(error.type).toBe(z.error.ClientError.TYPE.NO_VALID_CLIENT);
        });
    });

    it('rejects with an error if something else fails', done => {
      spyOn(TestFactory.client_repository.clientService, 'loadClientFromDb').and.returnValue(
        Promise.reject(new Error('Expected unit test error')),
      );

      TestFactory.client_repository
        .getValidLocalClient()
        .then(done.fail)
        .catch(error => {
          expect(error).toEqual(jasmine.any(Error));
          expect(error.type).toBe(z.error.ClientError.TYPE.DATABASE_FAILURE);
          done();
        });
    });
  });

  describe('_constructPrimaryKey', () => {
    it('returns a proper primary key for a client', () => {
      const actualPrimaryKey = TestFactory.client_repository._constructPrimaryKey(userId, clientId);
      const expectedPrimaryKey = `${userId}@${clientId}`;

      expect(actualPrimaryKey).toEqual(expectedPrimaryKey);
    });

    it('throws an error if missing user ID', () => {
      const functionCall = () => TestFactory.client_repository._constructPrimaryKey(undefined, clientId);

      expect(functionCall).toThrowError(z.error.ClientError, z.error.ClientError.MESSAGE.NO_USER_ID);
    });

    it('throws and error if missing client ID', () => {
      const functionCall = () => TestFactory.client_repository._constructPrimaryKey(userId, undefined);

      expect(functionCall).toThrowError(z.error.ClientError, z.error.ClientError.MESSAGE.NO_CLIENT_ID);
    });
  });

  describe('isCurrentClientPermanent', () => {
    beforeEach(() => {
      Environment.electron = false;
      TestFactory.client_repository.__test__assignEnvironment(Environment);
      TestFactory.client_repository.currentClient(undefined);
    });

    it('returns true on Electron', () => {
      const clientPayload = {type: ClientType.PERMANENT};
      const clientEntity = TestFactory.client_repository.clientMapper.mapClient(clientPayload, true);
      TestFactory.client_repository.currentClient(clientEntity);
      Environment.electron = true;
      TestFactory.client_repository.__test__assignEnvironment(Environment);
      const isPermanent = TestFactory.client_repository.isCurrentClientPermanent();

      expect(isPermanent).toBeTruthy();
    });

    it('returns true on Electron even if client is temporary', () => {
      const clientPayload = {type: ClientType.TEMPORARY};
      const clientEntity = TestFactory.client_repository.clientMapper.mapClient(clientPayload, true);
      TestFactory.client_repository.currentClient(clientEntity);
      Environment.electron = true;
      TestFactory.client_repository.__test__assignEnvironment(Environment);
      const isPermanent = TestFactory.client_repository.isCurrentClientPermanent();

      expect(isPermanent).toBeTruthy();
    });

    it('throws an error on Electron if no current client', () => {
      Environment.electron = true;
      TestFactory.client_repository.__test__assignEnvironment(Environment);
      const functionCall = () => TestFactory.client_repository.isCurrentClientPermanent();

      expect(functionCall).toThrowError(z.error.ClientError, z.error.ClientError.MESSAGE.CLIENT_NOT_SET);
    });

    it('returns true if current client is permanent', () => {
      const clientPayload = {type: ClientType.PERMANENT};
      const clientEntity = TestFactory.client_repository.clientMapper.mapClient(clientPayload, true);
      TestFactory.client_repository.currentClient(clientEntity);
      const isPermanent = TestFactory.client_repository.isCurrentClientPermanent();

      expect(isPermanent).toBeTruthy();
    });

    it('returns false if current client is temporary', () => {
      const clientPayload = {type: ClientType.TEMPORARY};
      const clientEntity = TestFactory.client_repository.clientMapper.mapClient(clientPayload, true);
      TestFactory.client_repository.currentClient(clientEntity);
      const isPermanent = TestFactory.client_repository.isCurrentClientPermanent();

      expect(isPermanent).toBeFalsy();
    });

    it('throws an error if no current client', () => {
      const functionCall = () => TestFactory.client_repository.isCurrentClientPermanent();

      expect(functionCall).toThrowError(z.error.ClientError, z.error.ClientError.MESSAGE.CLIENT_NOT_SET);
    });
  });

  describe('_isCurrentClient', () => {
    beforeEach(() => TestFactory.client_repository.currentClient(undefined));

    it('returns true if user ID and client ID match', () => {
      const clientEntity = new ClientEntity();
      clientEntity.id = clientId;
      TestFactory.client_repository.currentClient(clientEntity);
      TestFactory.client_repository.selfUser(new User(userId));
      const result = TestFactory.client_repository._isCurrentClient(userId, clientId);

      expect(result).toBeTruthy();
    });

    it('returns false if only the user ID matches', () => {
      const clientEntity = new ClientEntity();
      clientEntity.id = clientId;
      TestFactory.client_repository.currentClient(clientEntity);
      const result = TestFactory.client_repository._isCurrentClient(userId, 'ABCDE');

      expect(result).toBeFalsy();
    });

    it('returns false if only the client ID matches', () => {
      const clientEntity = new ClientEntity();
      clientEntity.id = clientId;
      TestFactory.client_repository.currentClient(clientEntity);
      const result = TestFactory.client_repository._isCurrentClient('ABCDE', clientId);

      expect(result).toBeFalsy();
    });

    it('throws an error if current client is not set', () => {
      const functionCall = () => TestFactory.client_repository._isCurrentClient(userId, clientId);

      expect(functionCall).toThrowError(z.error.ClientError, z.error.ClientError.MESSAGE.CLIENT_NOT_SET);
    });

    it('throws an error if client ID is not specified', () => {
      TestFactory.client_repository.currentClient(new ClientEntity());
      const functionCall = () => TestFactory.client_repository._isCurrentClient(userId);

      expect(functionCall).toThrowError(z.error.ClientError, z.error.ClientError.MESSAGE.NO_CLIENT_ID);
    });

    it('throws an error if user ID is not specified', () => {
      TestFactory.client_repository.currentClient(new ClientEntity());
      const functionCall = () => TestFactory.client_repository._isCurrentClient(undefined, clientId);

      expect(functionCall).toThrowError(z.error.ClientError, z.error.ClientError.MESSAGE.NO_USER_ID);
    });
  });
});
