import { channel, eventChannel, buffers } from 'redux-saga';
import { call, put, select, takeLatest, take, fork, cancel, cancelled } from 'redux-saga/effects';
import moment from 'moment';
import {
  getUser,
  getUserFollowedArtists,
  getArtistAlbums,
  getAlbumsTrackIds,
  createPlaylist,
  addTracksToPlaylist,
} from 'api';
import { chunks, getSpotifyUri, sleep } from 'helpers';
import { getSettings, getToken, getPlaylistForm, getUser as getUserSelector } from 'selectors';
import {
  SYNC,
  CREATE_PLAYLIST,
  CREATE_PLAYLIST_CANCEL,
  setSyncingProgress,
  setUser,
  syncFinished,
  syncError,
  addAlbums,
  setArtists,
  showErrorMessage,
  createPlaylistFinished,
  createPlaylistError,
} from 'actions';
import { SpotifyEntity, Moment, MomentFormat } from 'enums';

const REQUEST_WORKERS = 6;
const PROGRESS_ANIMATION_MS = 550;
const STATUS_OK = 'STATUS_OK';
const STATUS_ERROR = 'STATUS_ERROR';

function takeLatestCancellable(triggerAction, cancelAction, saga, ...args) {
  return fork(function* () {
    let task;

    while (true) {
      const action = yield take([triggerAction, cancelAction]);

      if (task) {
        yield cancel(task);
      }

      if (action.type === triggerAction) {
        task = yield fork(saga, ...args.concat(action));
      }
    }
  });
}

function* progressWorker(progress, setProgressAction) {
  const intervalChannel = yield call(eventChannel, (emitter) => {
    const intervalId = setInterval(() => {
      emitter(true);
    }, PROGRESS_ANIMATION_MS);

    return () => {
      clearInterval(intervalId);
    };
  });

  try {
    while (true) {
      yield take(intervalChannel);
      yield put(setProgressAction(progress.value));
    }
  } finally {
    if (yield cancelled()) {
      intervalChannel.close();

      yield put(setProgressAction(progress.value));
    }
  }
}

function* requestWorker(requestChannel, responseChannel) {
  while (true) {
    const request = yield take(requestChannel);

    try {
      const result = yield call(...request);

      yield put(responseChannel, { status: STATUS_OK, result });
    } catch (error) {
      yield put(responseChannel, { status: STATUS_ERROR, error });
    }
  }
}

function* syncSaga() {
  try {
    const token = yield select(getToken);
    const user = yield call(getUser, token);

    yield put(setUser(user));

    const artists = yield call(getUserFollowedArtists, token);

    yield put(setArtists(artists));

    const requestChannel = yield call(channel, buffers.expanding(10));
    const responseChannel = yield call(channel, buffers.expanding(10));

    for (let i = 0; i < REQUEST_WORKERS; i += 1) {
      yield fork(requestWorker, requestChannel, responseChannel);
    }

    const progress = { value: 0 };
    const progressWorkerTask = yield fork(progressWorker, progress, setSyncingProgress);

    const { groups, market, days } = yield select(getSettings);
    const minDate = moment().subtract(days, Moment.DAY).format(MomentFormat.ISO_DATE);

    for (const artist of artists) {
      yield put(requestChannel, [getArtistAlbums, token, artist.id, groups, market, minDate]);
    }

    for (let artistsFetched = 0; artistsFetched < artists.length; artistsFetched += 1) {
      const response = yield take(responseChannel);

      if (response.status === STATUS_OK) {
        yield put(addAlbums(response.result, minDate));
      }

      progress.value = ((artistsFetched + 1) / artists.length) * 100;
    }

    yield cancel(progressWorkerTask);
    yield call(sleep, PROGRESS_ANIMATION_MS);
    yield put(syncFinished());
  } catch (error) {
    yield put(showErrorMessage());
    yield put(syncError());

    throw error;
  }
}

function* createPlaylistSaga() {
  try {
    const token = yield select(getToken);
    const user = yield select(getUserSelector);
    const form = yield select(getPlaylistForm);
    const { market } = yield select(getSettings);
    const trackIds = [];

    for (const albumIdsChunk of chunks(form.albumIds, 20)) {
      const newTrackIds = yield call(getAlbumsTrackIds, token, albumIdsChunk, market);

      trackIds.push(...newTrackIds);
    }

    const trackUris = trackIds.map((trackId) => getSpotifyUri(trackId, SpotifyEntity.TRACK));
    let firstPlaylist;
    let part = 1;

    for (const playlistTrackUrisChunk of chunks(trackUris, 9500)) {
      const name = part > 1 ? `${form.name} (${part})` : form.name;
      const playlist = yield call(
        createPlaylist,
        token,
        user.id,
        name,
        form.description,
        form.isPrivate
      );

      if (!firstPlaylist) {
        firstPlaylist = playlist;
      }

      for (const trackUrisChunk of chunks(playlistTrackUrisChunk, 100)) {
        yield call(addTracksToPlaylist, token, playlist.id, trackUrisChunk);
      }

      part += 1;
    }

    yield put(createPlaylistFinished(firstPlaylist.id));
  } catch (error) {
    yield put(showErrorMessage());
    yield put(createPlaylistError());

    throw error;
  }
}

function* saga() {
  yield takeLatest(SYNC, syncSaga);
  yield takeLatestCancellable(CREATE_PLAYLIST, CREATE_PLAYLIST_CANCEL, createPlaylistSaga);
}

export default saga;
