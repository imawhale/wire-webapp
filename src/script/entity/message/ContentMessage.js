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

import moment from 'moment';
import ko from 'knockout';

import {copyText} from 'Util/ClipboardUtil';
import {t} from 'Util/LocalizerUtil';

import {Message} from './Message';
import {SuperType} from '../../message/SuperType';

export class ContentMessage extends Message {
  constructor(id) {
    super(id);

    this.assets = ko.observableArray([]);
    this.super_type = SuperType.CONTENT;
    this.replacing_message_id = null;
    this.edited_timestamp = ko.observable(null);

    this.was_edited = ko.pureComputed(() => !!this.edited_timestamp());

    this.reactions = ko.observable({});
    this.reactions_user_ets = ko.observableArray();
    this.reactions_user_ids = ko.pureComputed(() => {
      this.reactions_user_ets()
        .map(user_et => user_et.first_name())
        .join(', ');
    });

    this.quote = ko.observable();
    this.readReceipts = ko.observableArray([]);

    this.display_edited_timestamp = () => {
      return t('conversationEditTimestamp', moment(this.edited_timestamp()).format('LT'));
    };

    this.is_liked_provisional = ko.observable();
    this.is_liked = ko.pureComputed({
      read: () => {
        if (this.is_liked_provisional() != null) {
          const is_liked_provisional = this.is_liked_provisional();
          this.is_liked_provisional(null);
          return is_liked_provisional;
        }
        const likes = this.reactions_user_ets().filter(user_et => user_et.is_me);
        return likes.length === 1;
      },
      write: value => {
        return this.is_liked_provisional(value);
      },
    });
    this.other_likes = ko.pureComputed(() => this.reactions_user_ets().filter(user_et => !user_et.is_me));

    this.like_caption = ko.pureComputed(() => {
      if (this.reactions_user_ets().length <= 5) {
        return this.reactions_user_ets()
          .map(user_et => user_et.first_name())
          .join(', ');
      }
      return t('conversationLikesCaption', this.reactions_user_ets().length);
    });
  }

  /**
   * Add another content asset to the message.
   * @param {Asset} asset_et - New content asset
   * @returns {undefined} No return value
   */
  add_asset(asset_et) {
    this.assets.push(asset_et);
  }

  copy() {
    copyText(this.get_first_asset().text);
  }

  /**
   * Get the first asset attached to the message.
   * @returns {Asset} The first asset attached to the message
   */
  get_first_asset() {
    return this.assets()[0];
  }

  getUpdatedReactions({data: event_data, from}) {
    const reaction = event_data && event_data.reaction;
    const hasUser = this.reactions()[from];
    const shouldAdd = reaction && !hasUser;
    const shouldDelete = !reaction && hasUser;

    if (!shouldAdd && !shouldDelete) {
      return false;
    }

    const newReactions = {...this.reactions()};

    if (shouldAdd) {
      newReactions[from] = reaction;
    } else {
      delete newReactions[from];
    }

    return {reactions: newReactions, version: this.version + 1};
  }

  /**
   * @param {string} userId - The user id to check
   * @returns {boolean} `true` if the message mentions the user.
   */
  isUserMentioned(userId) {
    return this.has_asset_text()
      ? this.assets().some(assetEntity => assetEntity.is_text() && assetEntity.isUserMentioned(userId))
      : false;
  }

  /**
   * @param {string} userId - The user id to check
   * @returns {boolean} `true` if the message quotes the user.
   */
  isUserQuoted(userId) {
    return this.quote() ? this.quote().isQuoteFromUser(userId) : false;
  }

  /**
   * @param {string} userId - The user id to check
   * @returns {boolean} `true` if the user was mentioned or quoted.
   */
  isUserTargeted(userId) {
    return this.isUserMentioned(userId) || this.isUserQuoted(userId);
  }

  /**
   * Download message content.
   * @returns {undefined} No return value
   */
  download() {
    const asset_et = this.get_first_asset();
    const file_name = this.get_content_name();
    asset_et.download(file_name);
  }

  /**
   * Get content name.
   * @returns {string} The content/file name.
   */
  get_content_name() {
    const asset_et = this.get_first_asset();
    let {file_name} = asset_et;

    if (!file_name) {
      const date = moment(this.timestamp());
      file_name = `Wire ${date.format('YYYY-MM-DD')} at ${date.format('LT')}`;
    }

    if (asset_et.file_type) {
      const file_extension = asset_et.file_type.split('/').pop();
      file_name = `${file_name}.${file_extension}`;
    }

    return file_name;
  }
}
