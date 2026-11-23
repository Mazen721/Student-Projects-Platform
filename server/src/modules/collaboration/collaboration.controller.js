import * as collabService from './collaboration.service.js';
import * as mediaService from './media.service.js';

function actorMeta(req) {
  return {
    actor: req.effectiveUser || req.user,
    ip: req.ip,
  };
}

export async function listMyChannelsHandler(req, res, next) {
  try {
    const channels = await collabService.listMyChannels(actorMeta(req).actor);
    res.json({ data: channels });
  } catch (err) {
    next(err);
  }
}

export async function listProjectChannelsHandler(req, res, next) {
  try {
    const channels = await collabService.listProjectChannels(req.params.id, actorMeta(req).actor);
    res.json({ data: channels });
  } catch (err) {
    next(err);
  }
}

export async function createDirectChannelHandler(req, res, next) {
  try {
    const { channel, created } = await collabService.getOrCreateDirectChannel(
      req.params.id,
      req.body,
      actorMeta(req)
    );
    res.status(created ? 201 : 200).json({ data: channel });
  } catch (err) {
    next(err);
  }
}

export async function listMessagesHandler(req, res, next) {
  try {
    const messages = await collabService.listChannelMessages(req.params.channelId, req.query);
    res.json({ data: messages });
  } catch (err) {
    next(err);
  }
}

export async function sendMessageHandler(req, res, next) {
  try {
    const message = await collabService.sendMessage(
      req.params.channelId,
      req.body,
      actorMeta(req)
    );
    res.status(201).json({ data: message });
  } catch (err) {
    next(err);
  }
}

export async function markChannelReadHandler(req, res, next) {
  try {
    await collabService.markChannelRead(
      req.params.channelId,
      req.body.upToMessageId,
      actorMeta(req)
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function searchMessagesHandler(req, res, next) {
  try {
    const { items, page } = await collabService.searchMessagesInChannel(
      req.params.channelId,
      req.query
    );
    res.json({ data: items, page });
  } catch (err) {
    next(err);
  }
}

export async function moderateMessageHandler(req, res, next) {
  try {
    const message = await collabService.moderateMessage(
      req.params.messageId,
      req.body,
      actorMeta(req)
    );
    res.json({ data: message });
  } catch (err) {
    next(err);
  }
}

export async function listCommentsHandler(req, res, next) {
  try {
    const comments = await collabService.listComments(req.query);
    res.json({ data: comments });
  } catch (err) {
    next(err);
  }
}

export async function createCommentHandler(req, res, next) {
  try {
    const comment = await collabService.createComment(req.body, actorMeta(req));
    res.status(201).json({ data: comment });
  } catch (err) {
    next(err);
  }
}

export async function moderateCommentHandler(req, res, next) {
  try {
    const comment = await collabService.moderateComment(
      req.params.id,
      req.body,
      actorMeta(req)
    );
    res.json({ data: comment });
  } catch (err) {
    next(err);
  }
}

export async function createAnnouncementHandler(req, res, next) {
  try {
    const announcement = await collabService.createAnnouncement(req.body, actorMeta(req));
    res.status(201).json({ data: announcement });
  } catch (err) {
    next(err);
  }
}

export async function listAnnouncementsHandler(req, res, next) {
  try {
    const { items, page } = await collabService.listMyAnnouncements(
      actorMeta(req).actor,
      req.query
    );
    res.json({ data: items, page });
  } catch (err) {
    next(err);
  }
}

export async function listNotificationsHandler(req, res, next) {
  try {
    const { items, page, unreadCount } = await collabService.listMyNotifications(
      actorMeta(req).actor,
      req.query
    );
    res.json({ data: items, page, unreadCount });
  } catch (err) {
    next(err);
  }
}

export async function markNotificationsReadHandler(req, res, next) {
  try {
    await collabService.markNotificationsRead(req.body, actorMeta(req));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function listAlbumsHandler(req, res, next) {
  try {
    const albums = await mediaService.listProjectAlbums(req.params.id);
    res.json({ data: albums });
  } catch (err) {
    next(err);
  }
}

export async function createAlbumHandler(req, res, next) {
  try {
    const album = await mediaService.createMediaAlbum(req.params.id, req.body);
    res.status(201).json({ data: album });
  } catch (err) {
    next(err);
  }
}

export async function addMediaItemHandler(req, res, next) {
  try {
    const item = await mediaService.addMediaItem(req.params.albumId, req.body, actorMeta(req));
    res.status(201).json({ data: item });
  } catch (err) {
    next(err);
  }
}

export async function updateMediaItemHandler(req, res, next) {
  try {
    const item = await mediaService.updateMediaItem(req.params.itemId, req.body);
    res.json({ data: item });
  } catch (err) {
    next(err);
  }
}

export async function removeMediaItemHandler(req, res, next) {
  try {
    const result = await mediaService.removeMediaItem(
      req.params.itemId,
      req.body,
      actorMeta(req)
    );
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
