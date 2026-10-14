# Adding on-device models

The app implements image capture/import, previews, local persistence, history and deletion. It does not run inference, invent confidence scores or generate heatmaps.

The proposal lists brain MRI, bone X-rays, chest X-rays and mammograms. These are UI defaults, not model input validation. The requested lung category is **lung cancer**; the proposal describes broader lung disease. Confirm the model's actual labels and supported modality before enabling this category.

## Integration contract

`src/models.ts` defines `LocalModelAdapter` and an empty adapter registry. For each model, supply:

- The `.tflite` or `.onnx` artifact, version and license.
- Supported modality and acquisition requirements.
- Input dimensions, channel order, data type, normalization and quantization values.
- Output labels in exact tensor order, score interpretation and validated thresholds.
- Evaluation results and limitations on intended data and target phones.
- A supported explanation method if visual explanations are required.

Add a compatible native TensorFlow Lite or ONNX runtime once the models are known. Native runtimes require a development/release build; Expo Go supports the current UI but will not host arbitrary inference runtimes. Configure Metro to bundle model extensions and package weights in the app. Load only the selected model and release resources after use.

Implement `analyze()` to decode the image, apply the exact training preprocessing and run inference locally. Register the adapter in `src/models.ts`. Add an analysis screen and persisted result schema; update the explicit “not added” UI and enable analysis only when an adapter is available. Copying a model file into the repository alone does not enable inference.

Keep execution local. There is no network fallback or inference server.

## Validation

Test known fixtures, unsupported images, failed inference, output shapes, quantized inputs, repeated use, memory release and airplane-mode operation on target phones. Scores should only be described as confidence when that interpretation is justified. Never show a diagnosis for a failed or missing model.

Current image preparation converts picker images to JPEG at full quality without resizing/cropping. Review whether that conversion is appropriate for each model and retain lossless inputs if required. DICOM is unsupported. Camera photographs may not match the model's training distribution.
