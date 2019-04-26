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

import * as StorageUtil from 'Util/StorageUtil';

import {StorageKey} from '../storage/StorageKey';

/**
 * Cache repository for local storage interactions using amplify.
 *
 * @todo We have to come up with a smart solution to handle "amplify.store quota exceeded"
 *  This happened when doing "@cache_repository.set_entity user_et"
 *
 */
export class CacheRepository {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Deletes cached data.
   *
   * @param {boolean} [keepConversationInput=false] - Should conversation input be kept
   * @param {Array<string>} [protectedKeyPatterns=[StorageKey.AUTH.SHOW_LOGIN]] - Keys which should NOT be deleted from the cache
   * @returns {Array<string>} Keys which have been deleted from the cache
   */
  clearCache(keepConversationInput = false, protectedKeyPatterns = [StorageKey.AUTH.SHOW_LOGIN]) {
    const deletedKeys = [];

    if (keepConversationInput) {
      protectedKeyPatterns.push(StorageKey.CONVERSATION.INPUT);
    }

    for (const storedKey in amplify.store()) {
      const shouldBeDeleted = !protectedKeyPatterns.some(pattern => storedKey.startsWith(pattern));

      if (shouldBeDeleted) {
        StorageUtil.resetValue(storedKey);
        deletedKeys.push(storedKey);
      }
    }

    return deletedKeys;
  }
}
