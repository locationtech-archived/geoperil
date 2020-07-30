from pywps import Process, LiteralInput, LiteralOutput


class Echo(Process):
    def __init__(self):
        inputs = [
            LiteralInput('input', 'Input', data_type='string')
        ]
        outputs = [
            LiteralOutput('response', 'Output response', data_type='string')
        ]

        super(Echo, self).__init__(
            self._handler,
            identifier='echo',
            title='Echo Process',
            abstract='Returns the literal input',
            version='1',
            inputs=inputs,
            outputs=outputs,
            store_supported=True,
            status_supported=True
        )

    def _handler(self, request, response):
        response.outputs['response'].data = request.inputs['input'][0].data
        return response
