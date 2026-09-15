import type PhotoSwipe from 'photoswipe';
import type { PhotoSwipeOptions, SlideData, ZoomLevelOption } from 'photoswipe';

/** Passed through `window.ZhiMoPhotoSwipe` by `scripts/register-photoswipe.js`. */
interface PhotoSwipeConfig {
  modulePath: string;
  selector: string;
  exclude: string[];
  bgOpacity: number;
  padding: { top: number; bottom: number; left: number; right: number };
  mainClass: string;
  wheelToZoom: boolean;
  initialZoomLevel: ZoomLevelOption;
  secondaryZoomLevel: ZoomLevelOption;
  maxZoomLevel: ZoomLevelOption;
  minZoomFactor: number;
}

/** Fields read from the `zoomLevelsUpdate` event. */
interface ZoomLevelsEvent {
  zoomLevels: { fit: number; min: number };
}

type PhotoSwipeModule = typeof PhotoSwipe | { default: typeof PhotoSwipe };

const BOUND_FLAG = 'photoswipeBound';
const ZOOMABLE_CLASS = 'photoswipe-zoomable-image';
const FALLBACK_WIDTH = 1200;
const FALLBACK_HEIGHT_RATIO = 0.625;

const config = (window as unknown as { ZhiMoPhotoSwipe?: PhotoSwipeConfig }).ZhiMoPhotoSwipe;

if (config) {
  initPhotoSwipe(config);
}

function initPhotoSwipe(options: PhotoSwipeConfig): void {
  const excludeSelectors = filterValidSelectors(options.exclude);
  let activeGallery: PhotoSwipe | null = null;
  let isGalleryOpening = false;
  let photoswipeModulePromise: Promise<typeof PhotoSwipe> | null = null;

  /** Keep selectors the browser accepts; rejected ones are dropped and reported. */
  function filterValidSelectors(selectors: string[]): string[] {
    return selectors.filter(selector => {
      try {
        document.querySelector(selector);
        return true;
      } catch {
        console.warn('[zhimo] photoswipe: invalid exclude selector skipped:', selector);
        return false;
      }
    });
  }

  function loadPhotoSwipe(): Promise<typeof PhotoSwipe> {
    if (!photoswipeModulePromise) {
      photoswipeModulePromise = import(options.modulePath).then((module: PhotoSwipeModule) => {
        return 'default' in module ? module.default : module;
      });
    }

    return photoswipeModulePromise;
  }

  function matchesAny(image: HTMLImageElement): boolean {
    return excludeSelectors.some(selector => Boolean(image.closest(selector)));
  }

  function isExcluded(image: HTMLImageElement): boolean {
    if (image.closest('a')) return true;
    if (!getImageSource(image)) return true;
    return matchesAny(image);
  }

  function getImages(): HTMLImageElement[] {
    return Array.from(document.querySelectorAll<HTMLImageElement>(options.selector)).filter(image => {
      return !isExcluded(image);
    });
  }

  function getImageSource(image: HTMLImageElement): string {
    return image.dataset.pswpSrc || image.dataset.zoomSrc || image.currentSrc || image.src || '';
  }

  function numericAttribute(image: HTMLImageElement, name: string): number {
    const value = Number(image.dataset[name] ?? image.getAttribute(name));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function getDimensions(image: HTMLImageElement): { width: number; height: number } {
    const rect = image.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    const width = numericAttribute(image, 'pswpWidth')
      || image.naturalWidth
      || numericAttribute(image, 'width')
      || Math.round(rect.width * pixelRatio)
      || FALLBACK_WIDTH;
    const height = numericAttribute(image, 'pswpHeight')
      || image.naturalHeight
      || numericAttribute(image, 'height')
      || Math.round(rect.height * pixelRatio)
      || Math.round(width * FALLBACK_HEIGHT_RATIO);

    return { width, height };
  }

  function imageToItem(image: HTMLImageElement): SlideData {
    const { width, height } = getDimensions(image);
    const item: SlideData = {
      src: getImageSource(image),
      msrc: image.currentSrc || image.src || '',
      width,
      height,
      element: image,
      alt: image.getAttribute('alt') || ''
    };
    const srcset = image.dataset.pswpSrcset || image.getAttribute('srcset');

    if (srcset) item.srcset = srcset;
    return item;
  }

  function waitForImage(image: HTMLImageElement): Promise<void> {
    if (image.complete) return Promise.resolve();

    return new Promise(resolve => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
    });
  }

  function applyMinZoomLevel(event: ZoomLevelsEvent): void {
    const minZoom = event.zoomLevels.fit * options.minZoomFactor;
    if (options.minZoomFactor < 1 && Number.isFinite(minZoom) && minZoom > 0) {
      event.zoomLevels.min = Math.min(event.zoomLevels.min, minZoom);
    }
  }

  function openGallery(targetImage: HTMLImageElement): void {
    if (activeGallery || isGalleryOpening) return;

    isGalleryOpening = true;
    waitForImage(targetImage)
      .then(loadPhotoSwipe)
      .then(PhotoSwipeCtor => {
        const images = getImages();
        const index = images.indexOf(targetImage);

        isGalleryOpening = false;
        if (index < 0) return;

        const galleryOptions: PhotoSwipeOptions = {
          dataSource: images.map(imageToItem),
          index,
          bgOpacity: options.bgOpacity,
          padding: options.padding,
          mainClass: options.mainClass,
          showHideAnimationType: 'zoom',
          initialZoomLevel: options.initialZoomLevel,
          secondaryZoomLevel: options.secondaryZoomLevel,
          maxZoomLevel: options.maxZoomLevel,
          wheelToZoom: options.wheelToZoom,
          imageClickAction: 'zoom-or-close',
          doubleTapAction: 'zoom',
          bgClickAction: 'close'
        };
        const gallery = new PhotoSwipeCtor(galleryOptions);

        activeGallery = gallery;
        gallery.on('zoomLevelsUpdate', applyMinZoomLevel);
        gallery.on('destroy', () => {
          activeGallery = null;
        });
        gallery.init();
      })
      .catch(error => {
        isGalleryOpening = false;
        activeGallery = null;
        console.error('[zhimo] photoswipe:', error);
      });
  }

  function bindImage(image: HTMLImageElement): void {
    if (image.dataset[BOUND_FLAG] === 'true') return;

    image.dataset[BOUND_FLAG] = 'true';
    image.classList.add(ZOOMABLE_CLASS);
    image.addEventListener('click', event => {
      event.preventDefault();
      openGallery(image);
    });
  }

  getImages().forEach(bindImage);
}
