from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    """
    Every error body carries a human-readable `detail`, so the frontend can show one
    message without knowing the error type. Field errors stay under `errors`.
    """
    response = drf_exception_handler(exc, context)
    if response is None:
        return None
    data = response.data
    if isinstance(data, dict) and 'detail' in data:
        return response
    errors = data if isinstance(data, dict) else {'non_field_errors': data}
    first = next(iter(errors.values()), None)
    message = first[0] if isinstance(first, list) and first else 'Please check the highlighted fields.'
    response.data = {'detail': str(message), 'errors': errors}
    return response
