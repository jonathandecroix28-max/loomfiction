import { useState } from 'react';
import { isValidCoverUrl } from '../../utils/validation';
import { isDataImageUrl } from '../../utils/images/imageProcessing';

const URL_ERROR = "L'URL doit commencer par http:// ou https://";

const isValidCover = (value: string): boolean => isDataImageUrl(value) || isValidCoverUrl(value);

export function useCoverImage(initialValue: string = '') {
  const [url, setUrl] = useState(initialValue);
  const [error, setError] = useState('');

  const handleChange = (newUrl: string) => {
    setUrl(newUrl);
    setError(isValidCover(newUrl) ? '' : URL_ERROR);
  };

  const validate = (): boolean => {
    if (!isValidCover(url)) {
      setError(URL_ERROR);
      return false;
    }
    return true;
  };

  return { url, setUrl: handleChange, error, validate };
}