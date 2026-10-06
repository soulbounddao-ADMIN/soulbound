import * as SecureStore from "expo-secure-store";
import { createChunkedStorage, type KeyValueStore } from "./chunked-storage";

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const secureKeyValueStore: KeyValueStore = {
  getItem: (key) => SecureStore.getItemAsync(key, options),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
  removeItem: (key) => SecureStore.deleteItemAsync(key, options),
};

export const secureSessionStorage = createChunkedStorage(secureKeyValueStore);
