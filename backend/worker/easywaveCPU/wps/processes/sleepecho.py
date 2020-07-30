from pywps import Process, LiteralInput, LiteralOutput
from pywps.app.Common import Metadata


class SleepEcho(Process):

    def __init__(self):
        inputs = [
            LiteralInput('input', 'Input', data_type='string')
        ]
        outputs = [
            LiteralOutput('response', 'Output response', data_type='string')
        ]

        super(SleepEcho, self).__init__(
            self._handler,
            identifier='sleepecho',
            version='1',
            title='Sleep Echo Process',
            abstract="Returns the literal input after a delay of 15 seconds "
            + "and with progress updates",
            profile='',
            inputs=inputs,
            outputs=outputs,
            store_supported=True,
            status_supported=True
        )

    def _handler(self, request, response):
        import time

        sleep_delay = 5

        time.sleep(sleep_delay)
        response.update_status('PyWPS Process started. Waiting...', 33)
        time.sleep(sleep_delay)
        response.update_status('PyWPS Process started. Waiting...', 66)
        time.sleep(sleep_delay)
        response.update_status('PyWPS Process finished', 100)
        response.outputs['response'].data = request.inputs['input'][0].data

        return response
