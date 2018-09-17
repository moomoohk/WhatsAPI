import time
import os
import sys

from objects.contact import Contact
from objects.message import Message, MessageGroup
from objects.chat import Chat

from wapi_js_wrapper import WapiJsWrapper

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as ec
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.chrome.options import Options

from consts import Selectors, URL


class WhatsAPIDriver(object):
    def __init__(self, browser="firefox", username="API"):
        self.username = username
        self.browser_type = browser

        if self.browser_type.lower() == "firefox":
            # from https://github.com/siddhant-varma/WhatsAPI/blob/master/webwhatsapi/__init__.py
            self.path = os.path.join(os.path.dirname(sys.argv[0]), "firefox_cache", self.username)

            if not os.path.exists(self.path):
                os.makedirs(self.path)

            self._firefox_profile = webdriver.FirefoxProfile(self.path)
            self._driver = webdriver.Firefox(self._firefox_profile)

        if self.browser_type.lower() == "chrome":
            self._chrome_options = Options()
            self._chrome_options.add_argument(
                "user-data-dir=" + os.path.join(os.path.dirname(sys.argv[0]), "chrome_cache", self.username))
            # self._chrome_options.add_argument("no-sandbox")
            # self._chrome_options.add_argument("enable-logging")
            # self._chrome_options.add_argument("disable-dev-shm-usage")
            self._driver = webdriver.Chrome(
                chrome_options=self._chrome_options,
                service_log_path="chromedriver.log"
            )

        self.wapi_functions = WapiJsWrapper(self._driver)

        # Open page
        self._driver.get(URL)
        self._driver.implicitly_wait(10)

        self._driver.set_script_timeout(5)

        el = WebDriverWait(self._driver, 10).until(
            ec.visibility_of_element_located(
                (By.CSS_SELECTOR, "{0}, {1}".format(Selectors.QR_CODE, Selectors.MAIN_PAGE)))
        )

        # Detected QR code, give user time to pair and wait for main page
        if el.tag_name == "img":
            WebDriverWait(self._driver, 60).until(
                ec.visibility_of_element_located(
                    (By.CSS_SELECTOR, Selectors.MAIN_PAGE))
            )

    def first_run(self):
        if "Click to reload QR code" in self._driver.page_source:
            self._reload_qr_code()
        qr = self._driver.find_element_by_css_selector(Selectors.QR_CODE)
        qr.screenshot(self.username + ".png")
        WebDriverWait(self._driver, 60).until(
            ec.invisibility_of_element_located((By.CSS_SELECTOR, Selectors.QR_CODE)))

    def get_contacts(self):
        """
        Fetches list of all contacts

        This will return chats with people from the address book only
        Use get_all_chats for all chats

        :return: List of contacts
        :rtype: list[Chat]
        """
        all_contacts = self.wapi_functions.getAllContacts()

        return [Contact(contact, self) for contact in all_contacts]

    def get_all_chats(self):
        return [Chat(chat, self) for chat in self.wapi_functions.getAllChats()]

    def reset_unread(self):
        """
        Resets unread messages list
        """
        self._driver.execute_script("window.WAPI.lastRead = {}")

    def get_unread(self):
        """
        Fetches unread messages

        :return: List of unread messages grouped by chats
        :rtype: list[MessageGroup]
        """
        raw_message_groups = self.wapi_functions.getUnreadMessages()

        unread_messages = []
        for raw_message_group in raw_message_groups:
            chat = Chat(raw_message_group)

            messages = [Message(message) for message in raw_message_group["messages"]]

            unread_messages.append(MessageGroup(chat, messages))

        return unread_messages

    def get_unread_messages_in_chat(self, chat):
        raw_messages = self.wapi_functions.getUnreadMessagesInChat(str(chat.id))
        return [Message(message) for message in raw_messages]

    def get_all_messages_in_chat(self, chat, include_me=False):
        message_objs = self.wapi_functions.getAllMessagesInChat(str(chat.id), include_me)

        messages = []
        for message in message_objs:
            messages.append(Message(message))

        return messages

    def get_contact_from_id(self, contact_id):
        contact = self.wapi_functions.getContact(contact_id)

        assert contact, "Contact {0} not found".format(contact_id)

        return Contact(contact, self)

    def get_chat_from_id(self, chat_id):
        chat = self.wapi_functions.getChat(str(chat_id))

        assert chat, "Chat for id {0} not found".format(chat_id)

        return Chat(chat, self)

    def get_chat_from_phone_number(self, number):
        """
        Gets chat by phone number

        Number format should be as it appears in Whatsapp ID
        For example, for the number:
            +972-51-234-5678
        This function would receive:
            972512345678

        :param number: Phone number
        :return: Chat
        :rtype: Chat
        """
        chat = self.wapi_functions.getChatByNumber(number)
        chats = filter(lambda chat: not chat.is_group, self.get_all_chats())

        return next((contact for contact in chats if contact.id.startswith(number)), None)

    def get_contact_by_name(self, name):
        contact = self.wapi_functions.getContactByName(name)

        assert contact, "Contact {0} not found".format(name)

        return Contact(contact, self)

    def _reload_qr_code(self):
        self._driver.find_element_by_css_selector(Selectors.QR_RELOADER).click()

    def create_callback(self, callback_function):
        try:
            while True:
                messages = self.get_unread()
                if messages:
                    callback_function(messages)
                time.sleep(5)
        except KeyboardInterrupt:
            print "Exited"
