import os

from selenium.common.exceptions import WebDriverException


class JsException(Exception):
    def __init__(self, message=None):
        super(Exception, self).__init__(message)


class WapiJsWrapper(object):
    """
    Wraps JS functions in window.WAPI for easier use from python
    """

    def __init__(self, driver):
        self.driver = driver

    def __getattr__(self, item):
        """
        Finds functions in window.WAPI

        :param item: Function name
        :return: Callable function object
        :rtype: JsFunction
        """
        wapi_functions = dir(self)

        if item not in wapi_functions:
            raise AttributeError("Function {0} doesn't exist".format(item))

        return JsFunction(item, self.driver)

    def __dir__(self):
        """
        Reloads wapi.js and returns its functions

        :return: List of functions in window.WAPI
        """
        with file(os.path.join("js", "wapi.js"), "rb") as script:
            self.driver.execute_script(script.read())

        return self.driver.execute_script("return window.WAPI").keys()


class JsArg(object):
    """
    Represents a JS function argument
    """

    def __init__(self, obj):
        """
        Constructor

        :param obj: Python object to represent
        """
        self.obj = obj

    def __str__(self):
        """
        Casts self.obj from python type to valid JS literal

        :return: JS literal represented in a string
        """
        if type(self.obj) in [str, unicode]:
            return repr(str(self.obj))

        if type(self.obj) == bool:
            return str(self.obj).lower()

        return str(self.obj)


class JsFunction(object):
    """
    Callable object represents functions in window.WAPI
    """

    def __init__(self, function_name, driver):
        self.driver = driver
        self.function_name = function_name

    def __call__(self, *args, **kwargs):
        # Selenium's execute_async_script passes a callback function that should be called when the JS operation is done
        # It is passed to the WAPI function using arguments[0]
        if len(args):
            command = "return WAPI.{0}({1}, arguments[0])"\
                .format(self.function_name, ",".join([str(JsArg(arg)) for arg in args]))
        else:
            command = "return WAPI.{0}(arguments[0])".format(self.function_name)

        try:
            return self.driver.execute_script(command)
        except WebDriverException as e:
            raise JsException("Error in function {0} ({1}). Command: {2}".format(self.function_name, e.msg, command))
